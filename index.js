/*
   Multiple queries to get data from Reef Chain
   By Jimi Flowers (12/2021)
   Update (01/2022):
	- Added data from Actual Era instead of Last Completed Era.
	- Added Validator Identity (if not exist completed with 'Unidentified')
 */

 const { ApiPromise, WsProvider } = require('@polkadot/api');
 const keyring = require('@polkadot/ui-keyring').default;
 const { types } = require('@reef-defi/types');
 const BigNumber = require('bignumber.js');
 const polkautils = require('@polkadot/util');
 var wsProvider = "";

 keyring.initKeyring({
   isDevelopment: false,
 });

 const fs = require('fs');
 const prompts = require('prompts');
 const yargs = require('yargs');

const argv = yargs
  .scriptName("index.js")
  .option('chain', {
    alias: 'c',
    description: 'chain (network) target to get data. Can be mainnet or testnet',
    type: 'string',
  })
  .option('file', {
    alias: 'f',
    description: 'write output to file DATA.json instead STDOUT',
    type: 'boolean',
  })
  .usage("node index.js")
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'V')
  .argv;

let chain = argv.chain || "testnet";

const main = async () => {

    if (chain == "mainnet") {
	wsProvider = "wss://rpc.reefscan.com/ws";
    }else if (chain == "testnet") {
	wsProvider = "wss://rpc-testnet.reefscan.com/ws";
    } else {
	console.log("Target Chain must be [testnet|mainnet]. Default: testnet");
	process.exit(1);
    }

    console.log(`\n\x1b[45m\x1b[1m Getting data from Reef Chain \x1b[41m\x1b[1m(${chain})\x1b[0m\n`);
    console.log(`\x1b[1m -> Connecting to\x1b[0m`, wsProvider);
    const provider = new WsProvider(wsProvider);
    const api = await ApiPromise.create({ provider, types });
    await api.isReady;

    // Get last completed era
    const chainActiveEra = await api.query.staking.activeEra();
    const activeEra = JSON.parse(JSON.stringify(chainActiveEra)).index;
    const lastEra = activeEra - 1;
    console.log(`\x1b[1m -> Active Era is \x1b[0m\x1b[1;32m${activeEra}\x1b[0m`);

    // Get number of Validators
    const activeValidatorsObj = await api.query.staking.validatorCount();
    const activeValidators = JSON.parse(JSON.stringify(activeValidatorsObj));
    console.log(`\x1b[1m -> Number of Active Validators is \x1b[0m\x1b[1;32m${activeValidators}\x1b[0m`);

    // Get total bonded Tokens for era
    const stakeTotal = await api.query.staking.erasTotalStake(activeEra);
    const bondedTotal = JSON.parse(JSON.stringify(stakeTotal.toHuman()));
    console.log(`\x1b[1m -> Total amount of REEF tokens bonded on active era ${activeEra}: \x1b[0m\x1b[1;32m${bondedTotal}\x1b[0m`);

    // Check Era Points and Validator Commission
    const [validators] = await Promise.all([
        api.query.staking.erasRewardPoints(lastEra),
    ]);

    const validatorRewards = await api.query.staking.erasValidatorReward(lastEra);
    const rewardsTotal = JSON.parse(JSON.stringify(validatorRewards.toHuman()));
    console.log(`\x1b[1m -> Total amount of Rewards for era ${lastEra}: \x1b[0m\x1b[1;32m${rewardsTotal}\x1b[0m`);

    const totalEraPoints = JSON.parse(JSON.stringify(validators)).total;
    console.log(`\x1b[1m -> Total points for era ${lastEra}: \x1b[0m\x1b[1;32m${totalEraPoints}\x1b[0m`);

    for (var entry of validators.entries()) {
        var key = entry[0], value = entry[1];
        if(key == "individual")
        {
            activeValidatorSet = value;
        }
    }

    console.log(`\x1b[1m -> Era points distribution per Validator:\x1b[0m`);

    const DATA = {};
    let CurrentVal = [];

    DATA['activeEra'] = activeEra;
    DATA['activeValidators'] = activeValidators;
    DATA['bondedTotal'] = bondedTotal;
    DATA['rewardsTotal'] = rewardsTotal;
    DATA['lastEraPoints'] = totalEraPoints;
    DATA['Validators'] = [];

    var address = "";
    var pts = "";
    var percent = "";
    var ident = "";

    for (let [key,value] of activeValidatorSet) {
	var total = 0;
        address = JSON.parse(JSON.stringify(key));
	console.log(`\x1b[1m -> Validator Address: ${address}\x1b[0m`);
        pts = JSON.parse(JSON.stringify(value));
        var validatorData = await api.query.staking.validators(address);
        percent = JSON.parse(JSON.stringify(validatorData.commission.toHuman()));
	var id = (await api.query.identity.identityOf(address)).toJSON();
        if (id !== null) {
                ident = polkautils.hexToString(id.info.display.raw);
        } else {
	        var subid = (await api.query.identity.superOf(address)).toJSON();
        	if (subid !== null) {
                	subident = polkautils.hexToString(subid[1].raw);
	                id = (await api.query.identity.identityOf(subid[0])).toJSON();
	                var ident_name = polkautils.hexToString(id.info.display.raw);
			ident = ident_name + "/" + subident;
	        } else {
	                ident = "Unidentified";
        	}
	}

	const exposures = await api.query.staking.erasStakersClipped(activeEra,address);

	for (let [key,values] of exposures) {
            var min = 0;
            var mindata = 0;
            if (key == "others") {
	        values.forEach(function(o, i){
	            if (min === 0) {
		        min = JSON.parse(o.value);
			mindata = JSON.stringify(o.value.toHuman());
	            }else{
		        if (min > o.value) {
		            mindata = JSON.stringify(o.value.toHuman());
			    min = JSON.parse(o.value);
		        }
	            }
	        });
            } else if (key == "total") {
		total = JSON.stringify(values.toHuman());
	    }
        }

        CurrentVal = {
	    Address: address,
            Identity: ident,
            LastEraPoints: pts,
            ActualCommission: percent,
	    TotalBonded: JSON.parse(total),
	    LessNominatorStake: JSON.parse(mindata)
	}

	DATA['Validators'].push(CurrentVal);

	CurrentVal = {};

    }

    const FILEDATA = JSON.stringify(DATA, null, '\t');
    const writeFile = (filename, content) => {fs.writeFileSync(filename, content, () => {})};

    writeFile("DATA.json", FILEDATA);

    console.log(DATA);

    console.log(`\n\t\x1b[47m\x1b[34m\x1b[1m Data writed to file \x1b[31m\x1b[1mDATA.json\x1b[0m\n`);

    process.exit(0);

}

try {
    main();
} catch (error) {
    console.error(error);
}
