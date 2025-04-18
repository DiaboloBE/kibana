/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isEmpty } from 'lodash/fp';
import type {
  Datum,
  ElementClickListener,
  FlameElementEvent,
  HeatmapElementEvent,
  MetricElementEvent,
  PartialTheme,
  PartitionElementEvent,
  WordCloudElementEvent,
  XYChartElementEvent,
} from '@elastic/charts';
import { Chart, Partition, PartitionLayout, Settings } from '@elastic/charts';
import { EuiFlexGroup, EuiFlexItem, useEuiTheme } from '@elastic/eui';
import React, { useCallback, useMemo } from 'react';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';

import { ChartLegendItem } from './chart_legend_item';
import { NoData } from './no_data';
import { PatternRollup, SelectedIndex } from '../../../types';
import { useDataQualityContext } from '../../../data_quality_context';
import { FlattenedBucket } from '../types';
import { getPathToFlattenedBucketMap } from './utils/get_path_to_flattened_bucket_map';
import { getLayersMultiDimensional } from './utils/get_layers_multi_dimensional';
import { getLegendItems } from './utils/get_legend_items';

interface StyleProps {
  maxChartHeight?: number;
  minChartHeight: number;
  height?: number;
  width?: number;
}

const useStyles = ({ maxChartHeight, minChartHeight, height, width }: StyleProps) => {
  const { euiTheme } = useEuiTheme();

  return {
    chart: css({
      ...(maxChartHeight != null && { maxHeight: `${maxChartHeight}px` }),
      minHeight: `${minChartHeight}px`,
    }),

    legendContainer: css({
      marginLeft: euiTheme.size.m,
      marginTop: euiTheme.size.m,
      overflowY: 'auto',
      ...(height != null && { height: `${height}px` }),
      scrollbarWidth: 'thin',
      ...(width != null && { width: `${width}px` }),
    }),
  };
};

export const DEFAULT_MIN_CHART_HEIGHT = 240; // px
export const LEGEND_WIDTH = 220; // px
export const LEGEND_TEXT_WITH = 120; // px

export interface Props {
  accessor: 'sizeInBytes' | 'docsCount';
  flattenedBuckets: FlattenedBucket[];
  maxChartHeight?: number;
  minChartHeight?: number;
  onIndexSelected: ({ indexName, pattern }: SelectedIndex) => void;
  patternRollups: Record<string, PatternRollup>;
  valueFormatter: (value: number) => string;
}

interface GetGroupByFieldsResult {
  pattern: string;
  indexName: string;
}

export const getGroupByFieldsOnClick = (
  elements: Array<
    | FlameElementEvent
    | HeatmapElementEvent
    | MetricElementEvent
    | PartitionElementEvent
    | WordCloudElementEvent
    | XYChartElementEvent
  >
): GetGroupByFieldsResult => {
  const flattened = elements.flat(2);

  const pattern =
    flattened.length > 0 && 'groupByRollup' in flattened[0] && flattened[0].groupByRollup != null
      ? `${flattened[0].groupByRollup}`
      : '';

  const indexName =
    flattened.length > 1 && 'groupByRollup' in flattened[1] && flattened[1].groupByRollup != null
      ? `${flattened[1].groupByRollup}`
      : '';

  return {
    pattern,
    indexName,
  };
};

const StorageTreemapComponent: React.FC<Props> = ({
  accessor,
  flattenedBuckets,
  maxChartHeight,
  minChartHeight = DEFAULT_MIN_CHART_HEIGHT,
  onIndexSelected,
  patternRollups,
  valueFormatter,
}: Props) => {
  const styles = useStyles({
    maxChartHeight,
    minChartHeight,
    height: maxChartHeight,
    width: LEGEND_WIDTH,
  });
  const { euiTheme } = useEuiTheme();
  const { theme, baseTheme, patterns } = useDataQualityContext();
  const fillColor = useMemo(
    () => theme?.background?.color ?? baseTheme.background.color,
    [theme?.background?.color, baseTheme.background.color]
  );

  const treemapTheme = useMemo<PartialTheme>(
    () => ({
      partition: {
        fillLabel: { valueFont: { fontWeight: 700 } },
        idealFontSizeJump: 1.15,
        maxFontSize: 16,
        minFontSize: 4,
        sectorLineStroke: fillColor, // draws the light or dark "lines" between partitions
        sectorLineWidth: 1.5,
      },
    }),
    [fillColor]
  );

  const onElementClick: ElementClickListener = useCallback(
    (event) => {
      const { indexName, pattern } = getGroupByFieldsOnClick(event);

      if (!isEmpty(indexName) && !isEmpty(pattern)) {
        onIndexSelected({ indexName, pattern });
      }
    },
    [onIndexSelected]
  );

  const pathToFlattenedBucketMap = getPathToFlattenedBucketMap(flattenedBuckets);

  const layers = useMemo(
    () =>
      getLayersMultiDimensional({
        valueFormatter,
        layer0FillColor: fillColor,
        pathToFlattenedBucketMap,
        successColor: euiTheme.colors.success,
        dangerColor: euiTheme.colors.danger,
        primaryColor: euiTheme.colors.primary,
      }),
    [
      valueFormatter,
      fillColor,
      pathToFlattenedBucketMap,
      euiTheme.colors.success,
      euiTheme.colors.danger,
      euiTheme.colors.primary,
    ]
  );

  const valueAccessor = useCallback((d: Datum) => d[accessor], [accessor]);

  const legendItems = useMemo(
    () =>
      getLegendItems({
        patterns,
        flattenedBuckets,
        patternRollups,
        successColor: euiTheme.colors.success,
        dangerColor: euiTheme.colors.danger,
        primaryColor: euiTheme.colors.primary,
      }),
    [
      euiTheme.colors.danger,
      euiTheme.colors.primary,
      euiTheme.colors.success,
      flattenedBuckets,
      patternRollups,
      patterns,
    ]
  );

  if (flattenedBuckets.length === 0) {
    return <NoData />;
  }

  return (
    <EuiFlexGroup data-test-subj="storageTreemap" gutterSize="none">
      <EuiFlexItem css={styles.chart} grow={true}>
        {flattenedBuckets.length === 0 ? (
          <NoData />
        ) : (
          <Chart>
            <Settings
              baseTheme={baseTheme}
              showLegend={false}
              theme={[treemapTheme, theme || {}]}
              onElementClick={onElementClick}
              locale={i18n.getLocale()}
            />
            <Partition
              data={flattenedBuckets}
              id="spec_1"
              layers={layers}
              layout={PartitionLayout.treemap}
              valueAccessor={valueAccessor}
              valueFormatter={valueFormatter}
            />
          </Chart>
        )}
      </EuiFlexItem>

      <EuiFlexItem grow={false}>
        <div css={styles.legendContainer} data-test-subj="legend" className="eui-scrollBar">
          {legendItems.map(({ color, ilmPhase, index, pattern, sizeInBytes, docsCount }) => (
            <ChartLegendItem
              color={color}
              count={valueFormatter(accessor === 'sizeInBytes' ? sizeInBytes ?? 0 : docsCount)}
              dataTestSubj={`chart-legend-item-${ilmPhase}${pattern}${index}`}
              key={`${ilmPhase}${pattern}${index}`}
              onClick={
                index != null && pattern != null
                  ? () => {
                      onIndexSelected({ indexName: index, pattern });
                    }
                  : undefined
              }
              text={index ?? pattern}
              textWidth={LEGEND_TEXT_WITH}
            />
          ))}
        </div>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

export const StorageTreemap = React.memo(StorageTreemapComponent);
