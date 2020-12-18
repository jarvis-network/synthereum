import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-asset-symbols';
import { IsString } from 'class-validator';
import { ETHAddressValidator } from '../../shared/decorator/validate.decorator';

export class ExchangeRequestDTO {
  @ETHAddressValidator()
  sender!: string;
  @IsString()
  asset!: SyntheticSymbol;
  @IsString()
  dest_asset!: SyntheticSymbol;
  @IsString()
  collateral_amount!: string;
  @IsString()
  num_tokens!: string;
  @IsString()
  dest_num_tokens!: string;
}
