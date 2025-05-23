/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ErrorNode, ParserRuleContext, TerminalNode } from 'antlr4';
import {
  type ShowInfoContext,
  type SingleStatementContext,
  type RowCommandContext,
  type FromCommandContext,
  type EvalCommandContext,
  type StatsCommandContext,
  type LimitCommandContext,
  type SortCommandContext,
  type KeepCommandContext,
  type DropCommandContext,
  type RenameCommandContext,
  type DissectCommandContext,
  type GrokCommandContext,
  type MvExpandCommandContext,
  type ShowCommandContext,
  type EnrichCommandContext,
  type WhereCommandContext,
  default as esql_parser,
  type TimeSeriesCommandContext,
  IndexPatternContext,
  InlinestatsCommandContext,
  JoinCommandContext,
  type ChangePointCommandContext,
} from '../antlr/esql_parser';
import { default as ESQLParserListener } from '../antlr/esql_parser_listener';
import {
  createCommand,
  createFunction,
  createLiteral,
  textExistsAndIsValid,
  visitSource,
  createAstBaseItem,
} from './factories';
import { getPosition } from './helpers';
import {
  collectAllFields,
  collectAllAggFields,
  visitByOption,
  collectAllColumnIdentifiers,
  visitRenameClauses,
  visitOrderExpressions,
  getPolicyName,
  getMatchField,
  getEnrichClauses,
} from './walkers';
import type { ESQLAst, ESQLAstTimeseriesCommand } from '../types';
import { createJoinCommand } from './factories/join';
import { createDissectCommand } from './factories/dissect';
import { createGrokCommand } from './factories/grok';
import { createStatsCommand } from './factories/stats';
import { createChangePointCommand } from './factories/change_point';
import { createWhereCommand } from './factories/where';
import { createRowCommand } from './factories/row';
import { createFromCommand } from './factories/from';

export class ESQLAstBuilderListener implements ESQLParserListener {
  private ast: ESQLAst = [];

  constructor(public src: string) {}

  public getAst() {
    return { ast: this.ast };
  }

  /**
   * Exit a parse tree produced by the `showInfo`
   * labeled alternative in `esql_parser.showCommand`.
   * @param ctx the parse tree
   */
  exitShowInfo(ctx: ShowInfoContext) {
    const commandAst = createCommand('show', ctx);

    this.ast.push(commandAst);
    commandAst.text = ctx.getText();
    if (textExistsAndIsValid(ctx.INFO().getText())) {
      // TODO: these probably should not be functions, instead use "column", like: INFO <identifier>?
      commandAst?.args.push(createFunction('info', ctx, getPosition(ctx.INFO().symbol)));
    }
  }

  /**
   * Enter a parse tree produced by `esql_parser.singleStatement`.
   * @param ctx the parse tree
   */
  enterSingleStatement(ctx: SingleStatementContext) {
    this.ast = [];
  }

  /**
   * Exit a parse tree produced by `esql_parser.whereCommand`.
   * @param ctx the parse tree
   */
  exitWhereCommand(ctx: WhereCommandContext) {
    const command = createWhereCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.rowCommand`.
   * @param ctx the parse tree
   */
  exitRowCommand(ctx: RowCommandContext) {
    const command = createRowCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.fromCommand`.
   * @param ctx the parse tree
   */
  exitFromCommand(ctx: FromCommandContext) {
    const command = createFromCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.timeseriesCommand`.
   * @param ctx the parse tree
   */
  exitTimeSeriesCommand(ctx: TimeSeriesCommandContext): void {
    const node: ESQLAstTimeseriesCommand = {
      ...createAstBaseItem('ts', ctx),
      type: 'command',
      args: [],
      sources: ctx
        .indexPatternAndMetadataFields()
        .getTypedRuleContexts(IndexPatternContext)
        .map((sourceCtx) => visitSource(sourceCtx)),
    };
    this.ast.push(node);
    node.args.push(...node.sources);
  }

  /**
   * Exit a parse tree produced by `esql_parser.evalCommand`.
   * @param ctx the parse tree
   */
  exitEvalCommand(ctx: EvalCommandContext) {
    const commandAst = createCommand('eval', ctx);
    this.ast.push(commandAst);
    commandAst.args.push(...collectAllFields(ctx.fields()));
  }

  /**
   * Exit a parse tree produced by `esql_parser.statsCommand`.
   * @param ctx the parse tree
   */
  exitStatsCommand(ctx: StatsCommandContext) {
    const command = createStatsCommand(ctx, this.src);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.inlinestatsCommand`.
   * @param ctx the parse tree
   */
  exitInlinestatsCommand(ctx: InlinestatsCommandContext) {
    const command = createCommand('inlinestats', ctx);
    this.ast.push(command);

    // STATS expression is optional
    if (ctx._stats) {
      command.args.push(...collectAllAggFields(ctx.aggFields()));
    }
    if (ctx._grouping) {
      command.args.push(...visitByOption(ctx, ctx.fields()));
    }
  }

  /**
   * Exit a parse tree produced by `esql_parser.limitCommand`.
   * @param ctx the parse tree
   */
  exitLimitCommand(ctx: LimitCommandContext) {
    const command = createCommand('limit', ctx);
    this.ast.push(command);
    if (ctx.getToken(esql_parser.INTEGER_LITERAL, 0)) {
      const literal = createLiteral('integer', ctx.INTEGER_LITERAL());
      if (literal) {
        command.args.push(literal);
      }
    }
  }

  /**
   * Exit a parse tree produced by `esql_parser.sortCommand`.
   * @param ctx the parse tree
   */
  exitSortCommand(ctx: SortCommandContext) {
    const command = createCommand('sort', ctx);
    this.ast.push(command);
    command.args.push(...visitOrderExpressions(ctx.orderExpression_list()));
  }

  /**
   * Exit a parse tree produced by `esql_parser.keepCommand`.
   * @param ctx the parse tree
   */
  exitKeepCommand(ctx: KeepCommandContext) {
    const command = createCommand('keep', ctx);
    this.ast.push(command);
    command.args.push(...collectAllColumnIdentifiers(ctx));
  }

  /**
   * Exit a parse tree produced by `esql_parser.dropCommand`.
   * @param ctx the parse tree
   */
  exitDropCommand(ctx: DropCommandContext) {
    const command = createCommand('drop', ctx);
    this.ast.push(command);
    command.args.push(...collectAllColumnIdentifiers(ctx));
  }

  /**
   * Exit a parse tree produced by `esql_parser.renameCommand`.
   * @param ctx the parse tree
   */
  exitRenameCommand(ctx: RenameCommandContext) {
    const command = createCommand('rename', ctx);
    this.ast.push(command);
    command.args.push(...visitRenameClauses(ctx.renameClause_list()));
  }

  /**
   * Exit a parse tree produced by `esql_parser.dissectCommand`.
   * @param ctx the parse tree
   */
  exitDissectCommand(ctx: DissectCommandContext) {
    const command = createDissectCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.grokCommand`.
   * @param ctx the parse tree
   */
  exitGrokCommand(ctx: GrokCommandContext) {
    const command = createGrokCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.mvExpandCommand`.
   * @param ctx the parse tree
   */
  exitMvExpandCommand(ctx: MvExpandCommandContext) {
    const command = createCommand('mv_expand', ctx);
    this.ast.push(command);
    command.args.push(...collectAllColumnIdentifiers(ctx));
  }

  /**
   * Enter a parse tree produced by `esql_parser.showCommand`.
   * @param ctx the parse tree
   */
  enterShowCommand(ctx: ShowCommandContext) {
    const command = createCommand('show', ctx);
    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.enrichCommand`.
   * @param ctx the parse tree
   */
  exitEnrichCommand(ctx: EnrichCommandContext) {
    const command = createCommand('enrich', ctx);
    this.ast.push(command);
    command.args.push(...getPolicyName(ctx), ...getMatchField(ctx), ...getEnrichClauses(ctx));
  }

  /**
   * Exit a parse tree produced by `esql_parser.joinCommand`.
   *
   * Parse the JOIN command:
   *
   * ```
   * <type> JOIN identifier [ AS identifier ] ON expression [, expression [, ... ]]
   * ```
   *
   * @param ctx the parse tree
   */
  exitJoinCommand(ctx: JoinCommandContext): void {
    const command = createJoinCommand(ctx);

    this.ast.push(command);
  }

  /**
   * Exit a parse tree produced by `esql_parser.changePointCommand`.
   *
   * Parse the CHANGE_POINT command:
   *
   * CHANGE_POINT <value> [ ON <key> ] [ AS <target-type>, <target-pvalue> ]
   *
   * @param ctx the parse tree
   */
  exitChangePointCommand(ctx: ChangePointCommandContext): void {
    const command = createChangePointCommand(ctx);

    this.ast.push(command);
  }

  enterEveryRule(ctx: ParserRuleContext): void {
    // method not implemented, added to satisfy interface expectation
  }

  visitErrorNode(node: ErrorNode): void {
    // method not implemented, added to satisfy interface expectation
  }

  visitTerminal(node: TerminalNode): void {
    // method not implemented, added to satisfy interface expectation
  }

  exitEveryRule(ctx: ParserRuleContext): void {
    // method not implemented, added to satisfy interface expectation
  }
}
