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

# Mainnet contracts
Name               | address                                    |
-------------------|--------------------------------------------|
Archbishop         | 0xB8f2bFd0ad97000513C8E1CDB610E003eF0C9DdC | 
ArchbishopV2       |                                            | 
CourtJester        |                                            | 
GovernorAlpha      |                                            | 
KingLock           |                                            | 
KingServant        | 0xd7D8A77403d77502e9ebF4309B14A42E5747c490 | 
KingSwapBatchTrade |                                            | 
KingSwapFactory    | 0xf0FD65907f666648BB50a794c1b413681AC8B803 | 
KingSwapMigrator   |                                            | 
KingSwapRouter     | 0x8F9A39119A066e196752Ad495f4703FC5C6e2b8d | 
KingToken          | 0x5a731151d6510Eb475cc7a0072200cFfC9a3bFe5 | 
KingUni            |                                            | 
KingUniV2          |                                            | 
KingVoterCalc      |                                            | 
Migrator           |                                            | 
RoundTable         | 0x5F2Bf88BcF6DF28D19BEBEEb6C16E65D1f131C27 | 
UniStake           |                                            | 

KingSwap.deployer: 0xD31e459Ac72E2ccAD9A35b5b3367cfB4BaB0274F
