/**
 * Multiple query to get data from Reef Chain
 * By Jimi Flowers (12/2021)
 */

 const { ApiPromise, WsProvider } = require('@polkadot/api');
 const keyring = require('@polkadot/ui-keyring').default;
 const { types } = require('@reef-defi/types');
 const BigNumber = require('bignumber.js');

 keyring.initKeyring({
   isDevelopment: false,
 });
 
 const fs = require('fs');
 const prompts = require('prompts');
 const yargs = require('yargs');
 const wsProvider = "wss://rpc.reefscan.com/ws";

const main = async () => {

    console.log("\n\x1b[45m\x1b[1m Getting data from Reef Chain \x1b[0m\n");
    console.log(`\x1b[1m -> Connecting to\x1b[0m`, wsProvider);
    const provider = new WsProvider(wsProvider);
    const api = await ApiPromise.create({ provider, types });
    await api.isReady;

    // Get number of Validators
    const activeValidatorsObj = await api.query.staking.validatorCount();
    const activeValidators = JSON.stringify(activeValidatorsObj);
    console.log(`\x1b[1m -> Number of Active Validators is \x1b[0m\x1b[1;32m${activeValidators}\x1b[0m`);

    // Get last completed era
    const chainActiveEra = await api.query.staking.activeEra();
    const activeEra = JSON.parse(JSON.stringify(chainActiveEra)).index;
    const lastEra = activeEra - 1;
    console.log(`\x1b[1m -> Last completed era is \x1b[0m\x1b[1;32m${lastEra}\x1b[0m`);

    // Get total bonded Tokens for era
    const stakeTotal = await api.query.staking.erasTotalStake(lastEra);
    const bondedTotal = JSON.stringify(stakeTotal.toHuman());
    console.log(`\x1b[1m -> Total amount of REEF tokens bonded on era: \x1b[0m\x1b[1;32m${bondedTotal}\x1b[0m`);

    // Check Era Points and Validator Commission
    const [validators] = await Promise.all([
        api.query.staking.erasRewardPoints(lastEra),
    ]);

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

    for (let [key,value] of activeValidatorSet) {
        var address = JSON.stringify(key);
        var points = JSON.stringify(value);
        var validatorData = await api.query.staking.validators(JSON.parse(address));
        var commission = JSON.stringify(validatorData.commission.toHuman());
        console.log(`\x09\x1b[1m Validator: \x1b[0m\x1b[1;32m${address}\x1b[0m\x1b[0m\x1b[1m Points: \x1b[0m\x1b[1;32m${points}\x1b[0m\x1b[1m Commission: \x1b[0m\x1b[1;32m${commission}\x1b[0m`);
    }

    // Exposures
	const exposures = await api.query.staking.erasStakersClipped.entries(lastEra);

	//exposures.forEach(([key, exposure]) => {
	  //console.log('key arguments:', key.args.map((k) => k.toHuman()));
	  //console.log('     exposure:', exposure.toHuman());
	//});

    process.exit(0);
}

try {
    main();
} catch (error) {
    console.error(error);
}
