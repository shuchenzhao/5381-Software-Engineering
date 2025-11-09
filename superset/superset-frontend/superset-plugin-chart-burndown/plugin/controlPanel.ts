import { ControlPanelConfig } from '@superset-ui/core';

const controlPanel: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: 'Query',
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: 'Chart Options',
      expanded: true,
      controlSetRows: [
        ['row_limit'],
      ],
    },
  ],
};

export default controlPanel;
