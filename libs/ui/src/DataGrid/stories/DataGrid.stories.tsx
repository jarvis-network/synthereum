import React from 'react';
import { CellInfo } from 'react-table';
import { action } from '@storybook/addon-actions';

import { DataGridColumnProps, ColumnType, DataRows } from '../types';

import { Button } from '../../Button';
import { Icon } from '../../Icon';

import { DataGrid } from '..';

import { data, SampleData } from './data';

export default {
  title: 'DataGrid',
  component: DataGrid,
};

const columns: DataGridColumnProps[] = [
  {
    header: 'Ticket',
    key: 'col1',
    type: ColumnType.Text,
  },
  {
    header: 'Symbol',
    key: 'col2',
    type: ColumnType.Text,
  },
  {
    header: 'Profit (DAI)',
    key: 'col3',
    type: ColumnType.RangeColor,
    downColor: 'blue',
    upColor: 'red',
  },
];

const columnsNoHeader: DataGridColumnProps[] = [
  {
    key: 'col1',
    type: ColumnType.Text,
  },
  {
    key: 'col2',
    type: ColumnType.Text,
  },
  {
    key: 'col3',
    type: ColumnType.RangeColor,
    downColor: 'blue',
    upColor: 'red',
  },
];

const columnsWithActions: DataGridColumnProps[] = [
  {
    header: 'Ticket',
    key: 'col1',
    type: ColumnType.Text,
  },
  {
    header: 'Symbol',
    key: 'col2',
    type: ColumnType.Text,
  },
  {
    header: 'Profit (DAI)',
    key: 'col3',
    type: ColumnType.RangeColor,
    downColor: 'blue',
    upColor: 'red',
  },
  {
    header: 'Edit',
    key: 'edit',
    type: ColumnType.Icon,
    icon: 'BsPencil',
    onClick: (
      e: React.MouseEvent<HTMLButtonElement>,
      cellData: DataRows<SampleData>,
    ) => {
      action(`Click on Edit Column${cellData.col1}`);
    },
  },
  {
    header: 'Delete',
    key: 'delete',
    type: ColumnType.Icon,
    icon: 'BsTrash',
    onClick: (
      e: React.MouseEvent<HTMLButtonElement>,
      cellData: DataRows<SampleData>,
    ) => {
      action(`Click on Delete Column${cellData.col1}`);
    },
  },
];

const columnsWithCustomCell: DataGridColumnProps[] = [
  {
    header: 'Ticket',
    key: 'col1',
    type: ColumnType.Text,
  },
  {
    header: 'Edit',
    key: 'edit',
    type: ColumnType.CustomCell,
    cell: (cellData: CellInfo) => (
      <Button
        onClick={() => action(`Custom Cell Edit${cellData.original.col1}`)}
      >
        <Icon className="table-icon" icon="BsPencil" />
      </Button>
    ),
  },
];

export const Default = () => <DataGrid columns={columns} data={data} />;

export const DataGridNoHeader = () => (
  <DataGrid columns={columnsNoHeader} data={data} />
);

export const DataGridNoData = () => <DataGrid columns={columns} data={[]} />;

export const DataGridLoading = () => (
  <DataGrid columns={columns} data={data} loading />
);

export const DataGridWithActions = () => (
  <DataGrid columns={columnsWithActions} data={data} />
);

export const DataGridWithCustomCell = () => (
  <DataGrid columns={columnsWithCustomCell} data={data} />
);

export const DataGridWithNoPagination = () => (
  <DataGrid columns={columns} data={data} showPagination={false} />
);

export const DataGridWithNoSortNoResize = () => (
  <DataGrid
    columns={columnsWithActions}
    data={data}
    sortable={false}
    resizable={false}
  />
);
