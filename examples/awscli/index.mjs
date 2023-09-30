import * as pkgx from 'libpkgx';
import * as awsclijs from 'aws-cli-js';

const { Options, Aws } = awsclijs
const { porcelain: { install }, hooks: { useShellEnv } } = pkgx

const opts = new Options(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY)

await installAwsCli()

const aws = new Aws(opts)
const users = await aws.command('iam list-users')

console.log(users)

///////////////////////////////////////////
async function installAwsCli() {
  const { map, flatten } = useShellEnv()
  const installations = await install('aws.amazon.com/cli')
  Object.assign(process.env, flatten(await map({ installations })))
}
