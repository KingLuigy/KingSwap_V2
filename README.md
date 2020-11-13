# KingSwap_V2

## Install & build
```
$ yarn install && yarn compile
```

## Run tests
```
$ yarn test
```

## Play with it
In a terminal:
```
$ ./KingSwap_V2/scripts/start-ksw.sh --no-deploy
```

In another terminal:
```
$ npx truffle console --network ksw
truffle(ksw)> const [deployer, alice, bob, carl, carol, , anybody] = accounts
truffle(ksw)> const weth = await WETH9.new()
truffle(ksw)> const king = await KingToken.new()
truffle(ksw)> const factory = await KingSwapFactory.new(alice)
truffle(ksw)> const router = await KingSwapRouter.new(factory.address, weth.address)
truffle(ksw)> const kingWethPair = await KingSwapPair.at((await factory.createPair(king.address, weth.address)).logs[0].args.pair)
truffle(ksw)> const stokenKingWeth = await KingSwapSlippageToken.at((await kingWethPair.stoken()))
```
