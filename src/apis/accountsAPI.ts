import { inject, injectable } from 'inversify';
import * as isEmpty from 'is-empty';
import * as filterObject from 'filter-object';
import { Body, Get, JsonController, Post, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IAccountsModule, IDelegatesModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import accountSchema from '../schema/accounts';
import { AppConfig } from '../types/genericTypes';
import { publicKey } from '../types/sanityTypes';
import { APIError, DeprecatedAPIError } from './errors';
import { FieldsInModel } from '../types/utils';
import { AccountsModel } from '../models';

@JsonController('/api/accounts')
@injectable()
@IoCSymbol(Symbols.api.accounts)
export class AccountsAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule;
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @Get('/')
  @ValidateSchema()
  public async getAccount(@SchemaValid(accountSchema.getAccount)
                          @QueryParams() query: { address?: string, publicKey?: publicKey }) {
    if (isEmpty(query.address) && isEmpty(query.publicKey)) {
      throw new APIError('Missing required property: address or publicKey', 200);
    }

    const address = !isEmpty(query.publicKey)
      ? this.accountsModule.generateAddressByPublicKey(query.publicKey)
      : query.address;

    if (!isEmpty(query.address) && !isEmpty(query.publicKey) && address !== query.address) {
      throw new APIError('Account publicKey does not match address', 200);
    }
    const theQuery: { address: string, publicKey?: Buffer } = {address};
    if (!isEmpty(query.publicKey)) {
      theQuery.publicKey = Buffer.from(query.publicKey, 'hex');
    }
    const accData = await this.accountsModule.getAccount(theQuery);
    if (!accData) {
      throw new APIError('Account not found', 200);
    }
    return {
      account: {
        address             : accData.address,
        balance             : `${accData.balance}`,
        multisignatures     : accData.multisignatures || [],
        publicKey           : accData.hexPublicKey,
        secondPublicKey     : accData.secondPublicKey === null ? null : accData.secondPublicKey.toString('hex'),
        secondSignature     : accData.secondSignature,
        u_multisignatures   : accData.u_multisignatures || [],
        unconfirmedBalance  : `${accData.u_balance}`,
        unconfirmedSignature: accData.u_secondSignature,
      },
    };
  }

  @Get('/getBalance')
  @ValidateSchema()
  public async getBalance(@SchemaValid(accountSchema.getBalance)
                          @QueryParams() params: { address: string }) {
    const account            = await this.accountsModule
      .getAccount({address: params.address});
    const balance            = account ? `${account.balance}` : '0';
    const unconfirmedBalance = account ? `${account.u_balance}` : '0';
    return {balance, unconfirmedBalance};
  }

  @Get('/getPublicKey')
  @ValidateSchema()
  public async getPublickey(@SchemaValid(accountSchema.getPublicKey)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({address: params.address});
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    return {publicKey: account.hexPublicKey};
  }

  @Get('/delegates')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(accountSchema.getDelegates)
                            @QueryParams() params: { address: string }) {
    const account = await this.accountsModule
      .getAccount({address: params.address});
    if (!account) {
      throw new APIError('Account not found', 200);
    }
    if (account.delegates) {
      const {delegates} = await this.delegatesModule.getDelegates({orderBy: 'rank:desc'});
      return {
        delegates: delegates
          .filter((d) => account.delegates.indexOf(d.delegate.hexPublicKey) !== -1)
          .map((d) => ({
            username      : d.delegate.username,
            address       : d.delegate.address,
            publicKey     : d.delegate.hexPublicKey,
            vote          : d.delegate.vote,
            producedblocks: d.delegate.producedblocks,
            missedblocks  : d.delegate.missedblocks,
            rate          : d.info.rank,
            rank          : d.info.rank,
            approval      : d.info.approval,
            productivity  : d.info.productivity
          })),
      };
    }
    return {publicKey: account.publicKey};
  }

  @Get('/delegates/fee')
  @ValidateSchema()
  public async getDelegatesFee(@SchemaValid(accountSchema.getDelegatesFee)
                               @QueryParams() params: { height: number }) {
    return {
      fee: this.systemModule.getFees(params.height).fees.delegate,
    };
  }

  @Get('/top')
  @ValidateSchema()
  public async topAccounts(@SchemaValid(accountSchema.top)
                           @QueryParams() params: { limit?: number, offset?: number }) {
    if (!this.appConfig.topAccounts) {
      throw new APIError('Top Accounts is not enabled', 403);
    }
    const {limit, offset} = params;
    const returnFields: FieldsInModel<AccountsModel> = ['address', 'balance', 'publicKey'];
    const accs = await this.accountsModule
      .getAccounts({
          limit,
          offset,
          sort: {balance: -1},
        },
        returnFields
      );

    return accs
      .map((acc) => filterObject(acc, returnFields))
      .map((acc) => {
        // Remap publicKey to string.
        acc.publicKey = acc.publicKey ? acc.publicKey.toString('hex') : null;
        return acc;
      });
  }

  @Post('/open')
  @ValidateSchema()
  public async open(@SchemaValid(accountSchema.open)
                    @Body() body: { secret: string }): Promise<any> {
    throw new DeprecatedAPIError();
  }

  /**
   * @deprecated
   */
  @Put('/delegates')
  public async addDelegate() {
    throw new DeprecatedAPIError();
  }

  /**
   * @deprecated
   */
  @Post('/generatePublicKey')
  public async generatePublicKey() {
    throw new DeprecatedAPIError();
  }

}
