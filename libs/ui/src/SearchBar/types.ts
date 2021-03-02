import { ChangeEvent } from 'react';

import { InputProps } from '../Input/types';
import { Tab } from '../Tabs/types';
import { DataRows } from '../DataGrid/types';

interface TabWithFilter extends Tab {
  filterValue: string;
}

interface RenderPropData {
  filteredData: DataRows<any>[];
  query: string;
}

interface SearchBarPropsBase extends InputProps {
  tabs?: {
    tabs: TabWithFilter[];
    selected?: number;
    filterProp: string;
  };
  data?: DataRows<any>[];
  render?: (data: RenderPropData) => JSX.Element;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface SearchBarPropsWithPropFilter extends SearchBarPropsBase {
  queryFilterProp?: string;
}

interface SearchBarPropsWithCustomFilter extends SearchBarPropsBase {
  filter?: PropFilterFn;
}

export type SearchBarProps =
  | SearchBarPropsWithPropFilter
  | SearchBarPropsWithCustomFilter;

interface FilterDataOptions {
  query: string;
  currentTabValue?: string;
  tabFilterProp?: string;
}

interface FilterDataOptionsWithFilterProp extends FilterDataOptions {
  queryFilterProp?: string;
}

export type PropFilterFn = (
  data: DataRows<any>[],
  options: FilterDataOptions,
) => DataRows<any>[];

export type PropFilterWithFilterPropFn = (
  data: DataRows<any>[],
  options: FilterDataOptionsWithFilterProp,
) => DataRows<any>[];
