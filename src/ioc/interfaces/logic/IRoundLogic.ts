import { ITask } from 'pg-promise';
import { Slots } from '../../../helpers';
import { RoundLogicScope } from '../../../logic';
import { DBCustomOp, DBOp } from '../../../types/genericTypes';

export interface IRoundLogicNewable {
  new (scope: RoundLogicScope, slots: Slots): IRoundLogic;
}

export interface IRoundLogic {

  /**
   * Adds or remove the blocks to the generator account.
   * @returns {Promise<void>}
   */
  mergeBlockGenerator(): Array<DBOp<any>>;

  /**
   * Updates accounts and add a missing block to whoever skipped one
   * @returns {Promise<void>}
   */
  updateMissedBlocks(): DBOp<any>;

  /**
   * In case of backwards calls updateBlockId with '0';
   */
  markBlockId(): DBOp<any>;

  /**
   * REmove blocks higher than this block height
   */
  truncateBlocks(): DBOp<any>;

  /**
   * For each delegate in round calls mergeAccountAndGet with new Balance
   */
  applyRound(): Array<DBOp<any>>;

  /**
   * Performs operations to go to the next block
   */
  apply(): Array<DBOp<any>>;

  /**
   * go back from a future block
   */
  undo(): Array<DBOp<any>>;
}
