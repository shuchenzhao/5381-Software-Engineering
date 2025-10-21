import { ChartMetadata, registerChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import SupersetPluginChartBurndown from '../src/SupersetPluginChartBurndown';

const metadata = new ChartMetadata({
  name: 'Burndown',
  description: 'A simple burndown chart',
  thumbnail: undefined,
});

export default function install() {
  registerChartPlugin({
    metadata,
    transformProps,
    buildQuery,
    controlPanel,
    Chart: SupersetPluginChartBurndown,
  });
}
