import { QueryFormData } from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  // Minimal example: select ds and remaining columns
  const metrics = formData.metrics || [];
  return {
    columns: ['ds', 'remaining'],
    // other necessary query fields can be added by integrator
  };
}
