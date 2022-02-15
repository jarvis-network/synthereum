import React from 'react';
import ReactTable, { Column, CellInfo, TableProps } from 'react-table';

import { styled } from '../Theme';

import { DataGridColumnProps, ColumnType } from './types';
import DataGridPagination from './DataGridPagination';
import IconCell, { IconCellProps } from './ColumnTypes/icon';
import RangeCell, { RangeCellProps } from './ColumnTypes/rangeColor';

const TableContainer = styled(ReactTable)`
  background: ${props => props.theme.background.primary};
  border: 0;
  text-align: center;

  .blue {
    color: #00b0f0;
  }

  .red {
    color: ${props => props.theme.common.danger};
  }

  .table-icon {
    width: 12px;
  }

  .icon-btn {
    background: transparent;
    border: 0;
    outline: none;
  }

  .rt-td {
    font-size: ${props => props.theme.font.sizes.xs};
  }

  .rt-tbody,
  .rt-tr {
    background: ${props => props.theme.background.primary} !important;
  }

  .rt-resizable-header {
    box-shadow: none !important;

    :before {
      position: absolute;
      left: 50%;
      margin-left: -15px;
      width: 30px;
      border-bottom: 3px solid ${props => props.theme.common.success};
    }

    &.-sort-asc:before {
      content: '';
      bottom: 0;
    }

    &.-sort-desc:before {
      content: '';
      top: 0;
    }
  }

  .rt-tbody,
  .rt-tfoot {
    color: ${props => props.theme.gray.gray400};
  }

  .rt-thead {
    box-shadow: none;

    .rt-tr {
      .rt-th {
        border: 0;
        font-size: ${props => props.theme.font.sizes.xs};
        padding: 8px 10px 16px;
      }
    }
  }

  .rt-tbody {
    box-shadow: none;
    overflow-x: hidden;
    overflow-y: auto;

    .rt-tr-group {
      border-bottom: 0 !important;
      border-top: 1px solid ${props => props.theme.border.primary} !important;

      .rt-tr {
        background: ${props => props.theme.background.primary};

        &:hover {
          background: ${props => props.theme.background.secondary} !important;
        }

        .rt-td {
          border: 0;
          padding: 8px 10px 16px;

          a {
            color: ${props => props.theme.text.primary};
          }
        }
      }
    }
  }

  .rt-noData {
    background: ${props => props.theme.background.primary};
    color: ${props => props.theme.text.primary};
  }

  .-loading {
    display: none !important;
    background: ${props => props.theme.background.primary};
  }

  .-loading > div {
    color: ${props => props.theme.text.primary};
  }

  .rt-tfoot {
    box-shadow: none;

    .rt-td {
      border: 0;
    }
  }
`;

export type DataGridProps<RowType = any> = {
  columns: DataGridColumnProps[];
  data: RowType[];
} & Partial<Omit<TableProps, 'columns' | 'data'>>;

export function DataGrid<RowType = any>({
  columns,
  data,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20],
  pageSize,
  TheadComponent,
  ...props
}: DataGridProps<RowType>) {
  // Map columns to react-table column prop
  columns.forEach((column: Column<DataGridColumnProps>) => {
    const datagridProps = column as DataGridColumnProps;

    /* -------------------------------------------------------------------------- */
    /*                             Map Type for column                            */
    /* -------------------------------------------------------------------------- */

    // Define the relative mappings for each respective type
    const columnTypesMap = {
      // For column type Icon we return IconCell
      [ColumnType.Icon]: (cellData: CellInfo) =>
        IconCell(datagridProps as IconCellProps, cellData.original),
      // For column type RangeColor we return RangeCell
      [ColumnType.RangeColor]: (cellData: CellInfo) =>
        RangeCell(datagridProps as RangeCellProps, cellData.value),
      // For column type CustomCell we return  cell property of DataGridColumnProps
      [ColumnType.CustomCell]: datagridProps.cell,
    };
    /* ----------------------- Transform to `React-table` ----------------------- */

    Object.assign(column, {
      accessor: datagridProps.key,
      Header: datagridProps.header,
      className: datagridProps.className,
      width: datagridProps.width,
      Cell: datagridProps.type && columnTypesMap[datagridProps.type],
    });
  });

  const minRows = pageSize || defaultPageSize;

  const tableProps = {
    ...props,
    data,
    columns,
    defaultPageSize,
    pageSize,

    pageSizeOptions,
    minRows: data.length >= minRows ? minRows : data.length,
    PaginationComponent: DataGridPagination,
    TheadComponent: columns.every(item => !item.header)
      ? () => null
      : TheadComponent,
  };

  return <TableContainer {...tableProps} />;
}
