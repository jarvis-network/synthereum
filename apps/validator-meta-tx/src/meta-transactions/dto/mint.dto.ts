import { SyntheticSymbol } from '@jarvis-network/synthereum-contracts/dist/src/config/data/all-synthetic-asset-symbols';
import { IsString } from 'class-validator';
import { ETHAddressValidator } from '../../shared/decorator/validate.decorator';

export class MintRequestDTO {
  @ETHAddressValidator()
  sender!: string;
  @IsString()
  asset!: SyntheticSymbol;
  @IsString()
  collateral_amount!: string;
  @IsString()
  num_tokens!: string;
}
