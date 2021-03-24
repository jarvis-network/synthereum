import React, { useState } from 'react';
import { CellInfo } from 'react-table';
import { action } from '@storybook/addon-actions';
import { select, text } from '@storybook/addon-knobs';

import { styled } from '../../Theme';
import { DataGrid } from '../../DataGrid';
import { ColumnType } from '../../DataGrid/types';
import { Tabs } from '../../Tabs';
import { Flag } from '../../Flag';

import { PropFilterFn } from '../types';

import { SearchBar } from '..';

export default {
  title: 'SearchBar',
  component: SearchBar,
};

const StyledSearchBar = styled(SearchBar)`
  .icon {
    color: ${props => props.theme.text.secondary};
  }

  .group {
    & > div:first-child {
      padding-left: 30px;
    }
    border: none;
  }
`;

const StyledTabs = styled(Tabs)`
  & > *:first-child {
    background: transparent;
    border-radius: 0;
    border-top: 1px solid ${props => props.theme.border.primary};
    border-bottom: 1px solid ${props => props.theme.border.primary};
    padding-left: 30px;
    box-sizing: border-box;
  }
`;

const StyledHeader = styled.b`
  padding-left: 30px;
  margin-top: 50px;
  display: block;
`;

const StyledGrid = styled(DataGrid)`
  .text,
  .flag {
    text-align: left;
  }
  .number {
    text-align: right;
    padding-right: 30px !important;
  }
  .flag {
    padding-left: 30px !important;
  }
`;

export const Default = () => <SearchBar />;

export const WithActions = () => (
  <SearchBar
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
      action(`input text changed: ${e.currentTarget.value}`)();
    }}
  />
);

export const WithPlaceholder = () => (
  <SearchBar placeholder="Type here to search" />
);

const ExtraStyled = styled(SearchBar)`
  background: red;
  border-radius: 10px;

  input {
    background: red;
    color: white;
  }
`;

export const WithExtraStyles = () => (
  <ExtraStyled placeholder="Type here to search" />
);

const tabsList = [
  {
    title: 'All',
    filterValue: '',
  },
  {
    title: 'Fiat',
    filterValue: 'fiat',
  },
  {
    title: 'Crypto',
    filterValue: 'crypto',
  },
];

const grid = {
  columns: [
    {
      key: 'flag',
      type: ColumnType.CustomCell,
      cell: ({ original }: CellInfo) => <Flag flag={original.flag} />,
      className: 'flag',
    },
    {
      key: 'full_name',
      type: ColumnType.Text,
      className: 'text',
    },
    {
      key: 'name',
      type: ColumnType.Text,
      className: 'text',
    },
    {
      key: 'type',
      type: ColumnType.Text,
      className: 'text',
    },
    {
      key: 'value',
      type: ColumnType.Text,
      className: 'number',
    },
  ],
  data: [
    {
      flag: 'eur',
      full_name: 'Euro',
      type: 'fiat',
      name: 'EUR',
      value: 10,
      owned: true,
    },
    {
      flag: 'chf',
      full_name: 'Swiss Franc',
      type: 'crypto',
      name: 'CHF',
      value: 11,
      owned: true,
    },
    {
      flag: 'us',
      full_name: 'US Dollar',
      type: 'crypto',
      name: 'USD',
      value: 23,
      owned: false,
    },
    {
      flag: 'gbp',
      full_name: 'British Pound',
      type: 'crypto',
      name: 'GBP',
      value: 1200,
      owned: true,
    },
  ],
};

export const WithSingleGrid = () => (
  <StyledSearchBar
    data={grid.data}
    queryFilterProp="name"
    render={data => (
      <StyledGrid
        columns={grid.columns}
        data={data.filteredData}
        showPagination={false}
      />
    )}
  />
);

const customFilter: PropFilterFn = (data, { query }) => {
  const q = query.toLowerCase();

  return data.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      item.full_name.toLowerCase().includes(q),
  );
};

export const WithCustomFiltering = () => (
  <>
    <div>You can search by name or full name here</div>
    <StyledSearchBar
      data={grid.data}
      filter={customFilter}
      render={data => (
        <StyledGrid
          columns={grid.columns}
          data={data.filteredData}
          showPagination={false}
        />
      )}
    />
  </>
);

export const WithTabsAndSplitGridAndFilteringByFullName = () => {
  const [selected, setSelected] = useState(0);

  const tabs = {
    tabs: tabsList,
    selected,
    filterProp: 'type',
  };

  return (
    <StyledSearchBar
      tabs={tabs}
      data={grid.data}
      queryFilterProp="full_name"
      render={data => {
        const owned = data.filteredData.filter(row => row.owned);
        const other = data.filteredData.filter(row => !row.owned);

        return (
          <>
            <StyledTabs
              tabs={tabsList}
              selected={selected}
              onChange={setSelected}
            />
            <StyledHeader>You have</StyledHeader>
            <StyledGrid
              columns={grid.columns}
              data={owned}
              showPagination={false}
            />
            <StyledHeader>Others</StyledHeader>
            <StyledGrid
              columns={grid.columns}
              data={other}
              showPagination={false}
            />
          </>
        );
      }}
    />
  );
};

const decodeHtml = (string: string) => {
  const art = document.createElement('article');
  art.innerHTML = string;
  return art.innerHTML;
};

export const Knobs = () => {
  const queryFilterProp = select(
    'Query filter data key',
    ['name', 'full_name'],
    'name',
  );
  const placeholder = decodeHtml(text('Placeholder', 'Try "EUR"'));
  // ^ decode is needed because knobs values are encoded like `Tru &quot;Eur&quot;`

  const [selected, setSelected] = useState(0);

  const tabs = {
    tabs: tabsList,
    selected,
    filterProp: 'type',
  };

  return (
    <StyledSearchBar
      tabs={tabs}
      data={grid.data}
      queryFilterProp={queryFilterProp}
      placeholder={placeholder}
      render={data => {
        const owned = data.filteredData.filter(row => row.owned);
        const other = data.filteredData.filter(row => !row.owned);

        return (
          <>
            <StyledTabs
              tabs={tabsList}
              selected={selected}
              onChange={setSelected}
            />
            <StyledHeader>You have</StyledHeader>
            <StyledGrid
              columns={grid.columns}
              data={owned}
              showPagination={false}
            />
            <StyledHeader>Others</StyledHeader>
            <StyledGrid
              columns={grid.columns}
              data={other}
              showPagination={false}
            />
            Raw data returned:
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </>
        );
      }}
    />
  );
};
