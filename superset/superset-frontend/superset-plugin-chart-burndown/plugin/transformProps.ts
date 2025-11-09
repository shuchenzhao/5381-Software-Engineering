import { ChartProps } from '../src/types';

export default function transformProps(chartProps: any) {
  const { width, height, formData, queriesData } = chartProps;
  // Expect queriesData[0].data to be array of rows with ds and remaining
  const data = (queriesData && queriesData[0] && queriesData[0].data) || [];
  return { width, height, formData, data } as ChartProps;
}
