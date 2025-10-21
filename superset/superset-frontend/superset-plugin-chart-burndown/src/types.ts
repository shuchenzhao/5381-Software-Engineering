export type DataRecord = {
  ds: string | number | Date;
  remaining: number;
};

export interface ChartProps {
  width: number;
  height: number;
  data: DataRecord[];
  formData?: any;
}
