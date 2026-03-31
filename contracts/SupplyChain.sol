// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// -----------------------------------------------------------------
// SupplyChain.sol
// Tracks leafy-green produce from farm → retail using an immutable
// chain of checkpoints.  Uses OpenZeppelin AccessControl for
// role-based permissions (Farmer, Handler, Admin).
// -----------------------------------------------------------------

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  SupplyChain
 * @author CU Boulder, Introduction to Blockchain (Spring 2026)
 * @notice Tracks leafy-green produce batches through the supply chain.
 *         Each batch accumulates an on-chain history of checkpoints
 *         (location + status + details) as it moves from farm to shelf.
 */
contract SupplyChain is AccessControl {
    // =============================================================
    //                        CUSTOM ERRORS
    // =============================================================

    /// @notice Thrown when a function references a product ID that hasn't been registered.
    error ProductDoesNotExist(uint256 id);

    /// @notice Thrown when a checkpoint tries to set a status that isn't strictly forward.
    error InvalidStatusProgression(uint256 productId, Status current, Status requested);

    /// @notice Thrown when registerProduct() receives an empty name string.
    error EmptyName();

    /// @notice Thrown when registerProduct() receives an empty origin string.
    error EmptyOrigin();

    /// @notice Thrown when someone other than the current product owner calls transferOwnership.
    error NotProductOwner(uint256 productId, address caller, address owner);

    /// @notice Thrown when transferOwnership() is called with the zero address.
    error ZeroAddress();

    // =============================================================
    //                        ENUMS & STRUCTS
    // =============================================================

    /**
     * @notice The lifecycle stages a produce batch moves through.
     *         Status values are ordered so we can enforce forward-only progression.
     *         Registered(0) → Processed(1) → Shipped(2) → Distributed(3) → Retail(4)
     */
    enum Status {
        Registered,
        Processed,
        Shipped,
        Distributed,
        Retail
    }

    /**
     * @notice A single supply-chain checkpoint recorded by an actor.
     * @param actor      Address that recorded this checkpoint
     * @param status     New status after this checkpoint
     * @param location   Human-readable location (e.g. "Yuma, AZ")
     * @param details    Free-text details (e.g. "Washed and packaged")
     * @param timestamp  Block timestamp when the checkpoint was created
     */
    struct Checkpoint {
        address actor;
        Status status;
        string location;
        string details;
        uint256 timestamp;
    }

    /**
     * @notice Represents a single produce batch moving through the supply chain.
     * @param id               Unique product identifier (1-indexed)
     * @param name             Descriptive name (e.g. "Romaine Lettuce Batch #412")
     * @param origin           Farm name + location
     * @param currentOwner     Address of the current custodian
     * @param currentStatus    Latest lifecycle status
     * @param createdAt        Block timestamp when the product was registered
     * @param checkpointCount  Number of checkpoints recorded so far
     */
    struct Product {
        uint256 id;
        string name;
        string origin;
        address currentOwner;
        Status currentStatus;
        uint256 createdAt;
        uint256 checkpointCount;
    }

    // =============================================================
    //                        ROLE CONSTANTS
    // =============================================================

    /// @notice Role for farmers. Can register new produce batches.
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");

    /// @notice Role for handlers (processors, distributors, retailers). Can add checkpoints & receive ownership.
    bytes32 public constant HANDLER_ROLE = keccak256("HANDLER_ROLE");

    // =============================================================
    //                          STORAGE
    // =============================================================

    /// @notice Maps product ID → Product struct.
    mapping(uint256 => Product) public products;

    /// @notice Maps product ID → array of Checkpoint structs.
    mapping(uint256 => Checkpoint[]) private _checkpoints;

    /// @notice Total number of products registered so far (also used as the next ID).
    uint256 public productCount;

    // =============================================================
    //                          EVENTS
    // =============================================================

    /**
     * @notice Emitted when a new produce batch is registered by a farmer.
     * @param productId  The unique ID assigned to the new product
     * @param name       Descriptive name of the produce batch
     * @param origin     Farm name and location
     * @param farmer     Address of the farmer who registered it
     */
    event ProductRegistered(
        uint256 indexed productId,
        string name,
        string origin,
        address indexed farmer
    );

    /**
     * @notice Emitted when a new checkpoint is added to a product's history.
     * @param productId  The product this checkpoint belongs to
     * @param newStatus  The status the product moved to
     * @param location   Where the checkpoint was recorded
     * @param actor      Address that recorded the checkpoint
     */
    event CheckpointAdded(
        uint256 indexed productId,
        Status newStatus,
        string location,
        address indexed actor
    );

    /**
     * @notice Emitted when custody of a product is transferred to a new owner.
     * @param productId  The product being transferred
     * @param oldOwner   Previous custodian address
     * @param newOwner   New custodian address
     */
    event OwnershipTransferred(
        uint256 indexed productId,
        address indexed oldOwner,
        address indexed newOwner
    );

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    /**
     * @notice Deploys the contract and grants the deployer the DEFAULT_ADMIN_ROLE.
     *         The admin can then grant FARMER_ROLE and HANDLER_ROLE to other addresses.
     */
    constructor() {
        // The deployer becomes the admin who can manage all roles.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =============================================================
    //                      WRITE FUNCTIONS
    // =============================================================

    /**
     * @notice Register a new produce batch. Only callable by addresses with FARMER_ROLE.
     * @dev    Increments productCount first (so IDs start at 1), stores the Product,
     *         and emits ProductRegistered.
     * @param _name   Descriptive name (e.g. "Romaine Lettuce Batch #412")
     * @param _origin Farm name + location (e.g. "Green Valley Farm, Yuma, AZ")
     */
    function registerProduct(
        string calldata _name,
        string calldata _origin
    ) external onlyRole(FARMER_ROLE) {
        // --- Validation ---
        if (bytes(_name).length == 0) revert EmptyName();
        if (bytes(_origin).length == 0) revert EmptyOrigin();

        // --- State changes ---
        productCount += 1; // IDs are 1-indexed
        uint256 newId = productCount;

        products[newId] = Product({
            id: newId,
            name: _name,
            origin: _origin,
            currentOwner: msg.sender,
            currentStatus: Status.Registered,
            createdAt: block.timestamp,
            checkpointCount: 0
        });

        emit ProductRegistered(newId, _name, _origin, msg.sender);
    }

    /**
     * @notice Add a checkpoint to an existing product's history.
     *         Callable by addresses with FARMER_ROLE or HANDLER_ROLE.
     * @dev    Enforces that the new status is strictly greater than the current status
     *         (forward-only progression).  Pushes a Checkpoint struct and updates the
     *         product's currentStatus and checkpointCount.
     * @param _productId  ID of the product to update
     * @param _newStatus  The status to move the product to (must be > current)
     * @param _location   Where this checkpoint is being recorded
     * @param _details    Free-text details about what happened
     */
    function addCheckpoint(
        uint256 _productId,
        Status _newStatus,
        string calldata _location,
        string calldata _details
    ) external {
        // --- Access control: must be farmer or handler ---
        if (!hasRole(FARMER_ROLE, msg.sender) && !hasRole(HANDLER_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, HANDLER_ROLE);
        }

        // --- Validation ---
        if (_productId == 0 || _productId > productCount) {
            revert ProductDoesNotExist(_productId);
        }

        Product storage product = products[_productId];

        // Status must move forward (enum values increase: 0 → 1 → 2 → 3 → 4)
        if (uint8(_newStatus) <= uint8(product.currentStatus)) {
            revert InvalidStatusProgression(_productId, product.currentStatus, _newStatus);
        }

        // --- State changes ---
        _checkpoints[_productId].push(
            Checkpoint({
                actor: msg.sender,
                status: _newStatus,
                location: _location,
                details: _details,
                timestamp: block.timestamp
            })
        );

        product.currentStatus = _newStatus;
        product.checkpointCount += 1;

        emit CheckpointAdded(_productId, _newStatus, _location, msg.sender);
    }

    /**
     * @notice Transfer custody of a product to a new owner.
     *         Only the current owner of the product can call this.
     * @param _productId  ID of the product to transfer
     * @param _newOwner   Address of the new custodian (must not be zero address)
     */
    function transferOwnership(
        uint256 _productId,
        address _newOwner
    ) external {
        // --- Validation ---
        if (_productId == 0 || _productId > productCount) {
            revert ProductDoesNotExist(_productId);
        }
        if (_newOwner == address(0)) revert ZeroAddress();

        Product storage product = products[_productId];

        if (msg.sender != product.currentOwner) {
            revert NotProductOwner(_productId, msg.sender, product.currentOwner);
        }

        // --- State changes ---
        address oldOwner = product.currentOwner;
        product.currentOwner = _newOwner;

        emit OwnershipTransferred(_productId, oldOwner, _newOwner);
    }

    // =============================================================
    //                       READ FUNCTIONS
    // =============================================================

    /**
     * @notice Get the full Product struct for a given product ID.
     * @param _productId  ID of the product to look up
     * @return The Product struct (id, name, origin, currentOwner, currentStatus, createdAt, checkpointCount)
     */
    function getProduct(uint256 _productId) external view returns (Product memory) {
        if (_productId == 0 || _productId > productCount) {
            revert ProductDoesNotExist(_productId);
        }
        return products[_productId];
    }

    /**
     * @notice Get the full checkpoint history for a product.
     * @param _productId  ID of the product
     * @return Array of Checkpoint structs in chronological order
     */
    function getCheckpoints(uint256 _productId) external view returns (Checkpoint[] memory) {
        if (_productId == 0 || _productId > productCount) {
            revert ProductDoesNotExist(_productId);
        }
        return _checkpoints[_productId];
    }

    /**
     * @notice Get the total number of registered products.
     * @return The current productCount
     */
    function getProductCount() external view returns (uint256) {
        return productCount;
    }
}
