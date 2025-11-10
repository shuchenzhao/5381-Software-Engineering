export type DataRecord = {
  ds: string | number | Date;
  remaining?: number;
  remaining_hours?: number;
};

export interface ChartProps {
  width: number;
  height: number;
  data: DataRecord[];
  formData?: any;
}
