// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RealEstateEscrow — earnest-money escrow with an inspection contingency
/// @notice The escrow agent, as code. The buyer funds earnest money; the buyer
///         can release it to the seller or cancel for a full refund while the
///         inspection window is open; a neutral arbiter breaks deadlocks after
///         that. State is set before every external call (checks-effects-
///         interactions) and all payouts are nonReentrant.
contract RealEstateEscrow is ReentrancyGuard {
    enum State {
        AWAITING_FUNDING,
        FUNDED,
        RELEASED,
        REFUNDED
    }

    address public immutable buyer;
    address public immutable seller;
    address public immutable arbiter;
    uint256 public immutable inspectionDeadline;
    State public state;

    event Funded(address indexed buyer, uint256 amount);
    event Released(address indexed seller, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);
    event Resolved(address indexed arbiter, bool released);

    error NotBuyer();
    error NotArbiter();
    error InvalidState();
    error ZeroValue();
    error ZeroAddress();
    error PartiesNotDistinct();
    error InspectionPeriodExpired();
    error TransferFailed();

    /// @param _buyer Funds the escrow; can release or cancel within the window.
    /// @param _seller Receives the funds on release.
    /// @param _arbiter Neutral third party; resolves deadlocks either way.
    /// @param inspectionDays Buyer may cancel for a refund until
    ///        block.timestamp + inspectionDays * 1 days.
    constructor(address _buyer, address _seller, address _arbiter, uint256 inspectionDays) {
        if (_buyer == address(0) || _seller == address(0) || _arbiter == address(0)) {
            revert ZeroAddress();
        }
        if (_buyer == _seller || _buyer == _arbiter || _seller == _arbiter) {
            revert PartiesNotDistinct();
        }
        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        inspectionDeadline = block.timestamp + inspectionDays * 1 days;
    }

    modifier onlyBuyer() {
        if (msg.sender != buyer) revert NotBuyer();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert NotArbiter();
        _;
    }

    modifier inState(State expected) {
        if (state != expected) revert InvalidState();
        _;
    }

    /// @notice Buyer deposits the earnest money.
    function fund() external payable onlyBuyer inState(State.AWAITING_FUNDING) {
        if (msg.value == 0) revert ZeroValue();
        state = State.FUNDED;
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Buyer approves the deal — entire balance goes to the seller.
    function approveRelease() external onlyBuyer inState(State.FUNDED) nonReentrant {
        _release();
    }

    /// @notice Buyer cancels within the inspection window — full refund.
    function cancel() external onlyBuyer inState(State.FUNDED) nonReentrant {
        if (block.timestamp > inspectionDeadline) revert InspectionPeriodExpired();
        _refund();
    }

    /// @notice Arbiter breaks a deadlock in the seller's favor (any time while funded).
    function resolveRelease() external onlyArbiter inState(State.FUNDED) nonReentrant {
        _release();
        emit Resolved(msg.sender, true);
    }

    /// @notice Arbiter breaks a deadlock in the buyer's favor (any time while funded).
    function resolveRefund() external onlyArbiter inState(State.FUNDED) nonReentrant {
        _refund();
        emit Resolved(msg.sender, false);
    }

    function _release() internal {
        state = State.RELEASED;
        uint256 amount = address(this).balance;
        (bool ok, ) = seller.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Released(seller, amount);
    }

    function _refund() internal {
        state = State.REFUNDED;
        uint256 amount = address(this).balance;
        (bool ok, ) = buyer.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(buyer, amount);
    }
}
