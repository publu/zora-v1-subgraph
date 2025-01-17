import fs from 'fs-extra'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { MediaFactory } from '@zoralabs/core/dist/typechain/MediaFactory'
import { MarketFactory } from '@zoralabs/core/dist/typechain/MarketFactory'

async function start() {
  const args = require('minimist')(process.argv.slice(2))

  if (!args.chainId) {
    throw new Error('--chainId chain ID is required')
  }
  const path = `${process.cwd()}/.env${
    args.chainId === 80001 ? '.prod' : args.chainId === 4 ? '.dev' : '.local'
  }`

  await require('dotenv').config({ path })
  const provider = new JsonRpcProvider("https://rpc-mumbai.maticvigil.com/")
  const wallet = new Wallet(`0x488cc1c01dfc5dede4951334923bbfb60ea348d71ea31bc1eb1b499b675454cb`, provider)

  const sharedAddressPath = `${process.cwd()}/config/${args.chainId}.json`
  // @ts-ignore
  const config = JSON.parse(await fs.readFileSync(sharedAddressPath))
  if (config.marketAddress) {
    throw new Error(
      `market already exists in address book at ${sharedAddressPath}. Please move it first so it is not overwritten`
    )
  }
  if (config.mediaAddress) {
    throw new Error(
      `media already exists in address book at ${sharedAddressPath}. Please move it first so it is not overwritten`
    )
  }

  console.log('Deploying Market...')
  const deployTx = await new MarketFactory(wallet).deploy()
  console.log('Deploy TX: ', deployTx.deployTransaction.hash)
  await deployTx.deployed()
  console.log('Market deployed at ', deployTx.address)
  config.marketAddress = deployTx.address.substring(2)
  const receipt = await provider.getTransactionReceipt(deployTx.deployTransaction.hash)
  config.marketStartBlock = receipt.blockNumber

  console.log('Deploying Media...')
  const mediaDeployTx = await new MediaFactory(wallet).deploy(config.marketAddress)
  console.log(`Deploy TX: ${mediaDeployTx.deployTransaction.hash}`)
  await mediaDeployTx.deployed()
  console.log(`Media deployed at ${mediaDeployTx.address}`)
  config.mediaAddress = mediaDeployTx.address.substring(2)
  const mediaReceipt = await provider.getTransactionReceipt(
    mediaDeployTx.deployTransaction.hash
  )
  config.mediaStartBlock = mediaReceipt.blockNumber

  console.log('Configuring Market...')
  const market = MarketFactory.connect(config.marketAddress, wallet)
  const tx = await market.configure(config.mediaAddress)
  console.log(`Market configuration tx: ${tx.hash}`)
  await tx.wait()
  console.log(`Market configured.`)

  config.network = args.chainId === 4 ? 'rinkeby' : 'mumbai'

  await fs.writeFile(sharedAddressPath, JSON.stringify(config, null, 2))
  console.log(`Contracts deployed and configured. ☼☽`)
}

start().catch((e: Error) => {
  console.error(e)
  process.exit(1)
})
