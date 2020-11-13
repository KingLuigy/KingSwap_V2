pragma solidity 0.6.12;

import "./kingswap/interfaces/IKingSwapPair.sol";
import "./kingswap/interfaces/IKingSwapFactory.sol";


contract Migrator {
    address public archbishop;
    address public oldFactory;
    IKingSwapFactory public factory;
    uint256 public notBeforeBlock;
    uint256 public desiredLiquidity = uint256(-1);

    constructor(
        address _archbishop,
        address _oldFactory,
        IKingSwapFactory _factory,
        uint256 _notBeforeBlock
    ) public {
        require(
            _archbishop != address(0) && _oldFactory != address(0) && address(_factory) != address(0),
            "invalid address"
        );
        archbishop = _archbishop;
        oldFactory = _oldFactory;
        factory = _factory;
        notBeforeBlock = _notBeforeBlock;
    }

    function migrate(IKingSwapPair orig) public returns (IKingSwapPair) {
        require(msg.sender == archbishop, "not from archbishop");
        require(block.number >= notBeforeBlock, "too early to migrate");
        require(orig.factory() == oldFactory, "not from old factory");
        address token0 = orig.token0();
        address token1 = orig.token1();
        IKingSwapPair pair = IKingSwapPair(factory.getPair(token0, token1));
        if (pair == IKingSwapPair(address(0))) {
            pair = IKingSwapPair(factory.createPair(token0, token1));
        }
        uint256 lp = orig.balanceOf(msg.sender);
        if (lp == 0) return pair;
        desiredLiquidity = lp;
        orig.transferFrom(msg.sender, address(orig), lp);
        orig.burn(address(pair));
        pair.mint(msg.sender);
        desiredLiquidity = uint256(-1);
        return pair;
    }
}