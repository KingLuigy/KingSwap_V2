// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IKingSwapPair.sol";
import "./Archbishop.sol";
import "./RoundTable.sol";
import "./STokenMaster.sol";
import "./ArchbishopV2.sol";

struct IndexValue {
    uint256 keyIndex;
    address lpaddr;
}
struct KeyFlag {
    uint256 key;
    bool deleted;
}
struct ItMap {
    mapping(uint256 => IndexValue) data;
    KeyFlag[] keys;
    uint256 size;
}

library IterableMapping {
    function insert(
        ItMap storage self,
        uint256 key,
        address lpaddr
    ) internal returns (bool replaced) {
        uint256 keyIndex = self.data[key].keyIndex;
        self.data[key].lpaddr = lpaddr;
        if (keyIndex > 0) return true;
        else {
            keyIndex = self.keys.length;
            self.keys.push();
            self.data[key].keyIndex = keyIndex + 1;
            self.keys[keyIndex].key = key;
            self.size++;
            return false;
        }
    }

    function remove(ItMap storage self, uint256 key) internal returns (bool success) {
        uint256 keyIndex = self.data[key].keyIndex;
        if (keyIndex == 0) return false;
        delete self.data[key];
        self.keys[keyIndex - 1].deleted = true;
        self.size--;
    }

    function contains(ItMap storage self, uint256 key) internal view returns (bool) {
        return self.data[key].keyIndex > 0;
    }

    function iterateStart(ItMap storage self) internal view returns (uint256 keyIndex) {
        return iterateNext(self, uint256(-1));
    }

    function iterateValid(ItMap storage self, uint256 keyIndex) internal view returns (bool) {
        return keyIndex < self.keys.length;
    }

    function iterateNext(ItMap storage self, uint256 keyIndex) internal view returns (uint256 rkeyIndex) {
        keyIndex++;
        while (keyIndex < self.keys.length && self.keys[keyIndex].deleted) keyIndex++;
        return keyIndex;
    }

    function iterateGet(ItMap storage self, uint256 keyIndex) internal view returns (uint256 key, address lpaddr) {
        key = self.keys[keyIndex].key;
        lpaddr = self.data[key].lpaddr;
    }
}

contract KingVoterCalc {
    using SafeMath for uint256;
    ItMap public voteLpPoolMap; //Voter LP Address
    // Apply library functions to the data type.
    using IterableMapping for ItMap;

    IERC20 public king;
    RoundTable public table;
    STokenMaster public stoken;
    Archbishop public masterV1;
    ArchbishopV2 public masterV2;
    // TODO: define $KING-ETH pool address
    IERC20 public lpKingEth = IERC20(0xdEad000000000000000000000000000000000000); //KING-ETH

    address public owner;
    uint256 public lpPow = 2;
    uint256 public balancePow = 1;
    uint256 public stakePow = 1;
    bool public sqrtEnable = true;

    modifier onlyOwner() {
        require(owner == msg.sender, "Not Owner");
        _;
    }

    constructor(
        address _tokenAddr,
        address _tableAddr,
        address _stoken,
        address _masterAddr,
        address _masterV2Addr
    ) public {
        king = IERC20(_tokenAddr);
        table = RoundTable(_tableAddr);
        stoken = STokenMaster(_stoken);
        masterV1 = Archbishop(_masterAddr);
        masterV2 = ArchbishopV2(_masterV2Addr);
        owner = msg.sender;
        // TODO: define voting pools addresses
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-ETH
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-USDT
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-USDC
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-DAI
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-SUSHI
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xdEad000000000000000000000000000000000000); //$KING-UNI
    }

    function sqrt(uint256 x) public pure returns (uint256 y) {
        uint256 z = x.add(1).div(2);
        y = x;
        while (z < y) {
            y = z;
            z = x.div(z).add(z).div(2);
        }
    }

    function totalSupply() external view returns (uint256) {
        uint256 voterTotal = 0;
        uint256 _vCtKings = 0;
        uint256 tableBalance = 0;
        address _vLpToken;

        tableBalance = king.balanceOf(address(table));
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            //count lp contract kingnums
            (, _vLpToken) = voteLpPoolMap.iterateGet(i);
            _vCtKings = _vCtKings.add(king.balanceOf(_vLpToken));
        }

        voterTotal =
            king.totalSupply().sub(tableBalance).sub(_vCtKings).mul(balancePow) +
            _vCtKings.mul(lpPow) +
            tableBalance.mul(stakePow);
        if (sqrtEnable == true) {
            return sqrt(voterTotal);
        }
        return voterTotal;
    }

    function _getUserLpKings(address _voter, address _vLpTokenAddr) internal view returns (uint256) {
        IERC20 _vtmpLpToken;
        IERC20 _vLpToken;
        uint256 _vUserLp = 0;
        uint256 _vtmpUserLp = 0;
        uint256 _vCtKingNum = 0;
        uint256 _vUserKingNum = 0;
        IKingSwapPair _vPair;

        if (king.balanceOf(_vLpTokenAddr) == 0) {
            return 0;
        }
        _vLpToken = IERC20(_vLpTokenAddr);
        //v1 pool
        for (uint256 j = 0; j < masterV1.poolLength(); j++) {
            (_vtmpLpToken, , , ) = masterV1.poolInfo(j);
            if (_vtmpLpToken == _vLpToken) {
                (_vtmpUserLp, ) = masterV1.userInfo(j, _voter);
                _vUserLp = _vUserLp.add(_vtmpUserLp);
                break;
            }
        }
        //v2 pool
        for (uint256 j = 0; j < masterV2.poolLength(); j++) {
            (_vtmpLpToken, , , , , , ) = masterV2.poolInfo(j);
            if (_vtmpLpToken == _vLpToken) {
                (, , _vtmpUserLp, , , ) = masterV2.userInfo(j, _voter);
                _vUserLp = _vUserLp.add(_vtmpUserLp);
                break;
            }
        }
        //stokenmaster pool
        if (lpKingEth == _vLpToken) {
            (, , _vtmpUserLp, ) = stoken.userInfo(0, _voter);
            _vUserLp = _vUserLp.add(_vtmpUserLp);
        }
        //user balance lp
        _vPair = IKingSwapPair(_vLpTokenAddr);
        _vUserLp = _vUserLp.add(_vPair.balanceOf(_voter));
        //user deposit kingnum = user_lptoken*contract_kingnum/contract_lptokens
        _vCtKingNum = king.balanceOf(address(_vLpToken));
        _vUserKingNum = _vUserLp.mul(_vCtKingNum).div(_vPair.totalSupply());
        return _vUserKingNum;
    }

    //sum user deposit kingnum
    function balanceOf(address _voter) external view returns (uint256) {
        uint256 _votes = 0;
        uint256 _vCtKingNum = 0;
        uint256 _vTableKingNum = 0;
        address _vLpTokenAddr;

        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (, _vLpTokenAddr) = voteLpPoolMap.iterateGet(i);
            _vCtKingNum = _vCtKingNum.add(_getUserLpKings(_voter, _vLpTokenAddr));
        }

        _vTableKingNum = table.balanceOf(_voter).mul(king.balanceOf(address(table))).div(table.totalSupply());
        _votes = _vCtKingNum.mul(lpPow) + king.balanceOf(_voter).mul(balancePow) + _vTableKingNum.mul(stakePow);
        if (sqrtEnable == true) {
            return sqrt(_votes);
        }
        return _votes;
    }

    function addVotePool(address newLpAddr) public onlyOwner {
        address _vTmpLpAddr;
        uint256 key = 0;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            require(_vTmpLpAddr != newLpAddr, "newLpAddr already exist");
        }
        for (key = 0; voteLpPoolMap.iterateValid(key); key++) {
            if (voteLpPoolMap.contains(key) == false) {
                break;
            }
        }
        voteLpPoolMap.insert(key, newLpAddr);
    }

    function delVotePool(address newLpAddr) public onlyOwner {
        uint256 key = 0;
        address _vTmpLpAddr;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (key, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            if (_vTmpLpAddr == newLpAddr) {
                voteLpPoolMap.remove(key);
                return;
            }
        }
    }

    function getVotePool(address newLpAddr) external view returns (uint256) {
        address _vTmpLpAddr;
        uint256 key = 0;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (key, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            if (_vTmpLpAddr == newLpAddr) {
                return key;
            }
        }
        return 0;
    }

    function setSqrtEnable(bool enable) public onlyOwner {
        if (sqrtEnable != enable) {
            sqrtEnable = enable;
        }
    }

    function setPow(
        uint256 lPow,
        uint256 bPow,
        uint256 sPow
    ) public onlyOwner {
        //no need to check pow ?= 0
        if (lPow != lpPow) {
            lpPow = lPow;
        }
        if (bPow != balancePow) {
            balancePow = bPow;
        }
        if (sPow != stakePow) {
            stakePow = sPow;
        }
    }
}
