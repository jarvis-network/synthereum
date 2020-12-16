# Fee Calculations

## Mint jEUR->USDC with gross USDC | Assuming fee = 0.2% and EUR/USD = 2.00

```js
gross_collateral = 100 USDC // (only UI)
net_collateral = gross_collateral / ( 1 + fee_percent) = 100/1.002 = 99.8003992015968063872 // (only SC)
fee_amount = gross_collateral - net_collateral = 100 - 99.8003992015968063872 = 0.1996007984031936128 // (only for UI)
Check in SC: fee_amount = fee_percentage * net_collateral = 0.002 * 99.8003992015968063872 = 0.1996007984031936128 // (in SC)
net_token_amount = net_collateral * ex_rate = 99.8003992015968063872 * 0.5 = 49.9001996007984031936 // (both SC and UI)
```

## Mint jEUR->USDC with gross jEUR | Assuming fee = 0.2% and EUR/USD = 2.00

```js
net_output_synth = 50 jEUR // (both UI and SC)
net_input_collateral = net_output_synth * usdToEurRate = 50 * 2 = 100 // (only SC)
gross_input_collateral = net_input_collateral * (1 + fee_percentage) = 100 * 1.002 = 100.2 // (only UI)
fee_amount = gross_collateral - net_input_collateral = 0.2 // (only UI)
```

## Redeem jEUR->USDC with gross USDC | Assuming fee = 0.2% and EUR/USD = 2.00

```js
gross_collateral = 100 USDC // (only UI)
net_collateral = gross_collateral / ( 1 + fee_percent) = 100/1.002 = 99.8003992015968063872 // (in UI for SC)
fee_amount = gross_collateral - net_collateral = 100 - 99.8003992015968063872 = 0.1996007984031936128 // (only for UI)
fee_amount = fee_percentage * net_collateral = 0.002 * 99.8003992015968063872 = 0.1996007984031936128 // (in SC)
net_token_amount = net_collateral * ex_rate = 99.8003992015968063872 * 0.5 = 49.9001996007984031936 // (both SC and UI)
```

## Redeem jEUR->USDC with gross jEUR jEUR->USDC with gross jEUR | Assuming fee = 0.2% and EUR/USD = 2.00

```js
net_token_amount = 50 jEUR // (both UI and SC)
gross_collateral = net_token_amount / ex_rate = 50 / 0.5 = 100 // (only SC)
net_collateral = gross_collateral * (1 - fee_percentage) = 100 * 1.002 = 99.8 // (only UI)
fee_amount = gross_collateral - net_collateral = 0.2 // (only UI)
```

## Exchange jEUR->jCHF with gross jEUR | Assuming fee = 0.2% and EUR/USD = 2 and CHF/USD = 4 | EUR/CHF = 2

Same as: Redeem jEUR for USDC with gross jEUR

```js
net_input_token_amount = 50 jEUR // (both UI and SC)
gross_collateral = net_input_token_amount / ex_rate = 50 / 0.5 = 100 USDC // (only SC)
net_collateral = gross_collateral * (1 - fee_percentage) = 100 * 1.002 = 99.8 USDC // (temp variable)
fee_amount = gross_collateral - net_collateral = 0.2 USDC // (only UI)
fee_amount = gross_collateral * fee_percentage = 100 * 0.002 = 0.2 USDC // (Check in SC)
net_output_token_amount = net_collateral * usdToChfRate = 99.8 * 4 = 399.2 jCHF // (both UI and SC)
```

Verification:

```js
1 EUR = 2 USD
2 USD = 8 CHF

50 jEUR gross = 49.9 jEUR net
collateral = 99.8 USDC
output CHF = 99.8 * 4 = 399.2
```

## Exchange jEUR->jCHF with gross jCHF | Assuming fee = 0.2% and EUR/USD = 2.00 and CHF/USD = 4

```js
net_output_token_amount = 400 jCHF // (both UI and SC)
net_collateral = net_input_token_amount / usdToEurRate = 400 / 4 = 100 USDC // (temp variable)
gross_collateral = net_collateral / (1 - fee_percentage) = 100 / 99.8 = 100.2004008016032064128 USDC // (only SC)
fee_amount = gross_collateral - net_collateral = 100.2004008016032064128 - 100 = 0.2004008016032064128 USDC // (only UI)
Check in SC: fee_amount = gross_collateral * fee_percentage = 100.2004008016032064128 * 0.002 = 0.2004008016032064128 USDC
net_input_token_amount = gross_collateral * usdToEurRate = 100.2004008016032064128 * 0.5 = 50.1002004008016032064 jEUR // (both UI and SC)
```

Verification:

```js
gross_token_input = 50.1002004008016032064 jEUR
net_token_input = gross_token_input * (1 - fee_percentage) = 50.1002004008016032064 * (1 − 0.002) = 50 jEUR
net_collateral = net_token_input * (1 / usdToEurRate) = 50 * (1 / 0.5) = 50 * 2 = 100 USDC
net_output_token = net_collateral * usdToChfRate = 100 * 4 = 400 jCHF
```
