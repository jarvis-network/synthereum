import React, { useState } from 'react';

import { Input } from '../Input';
import { DataRows } from '../DataGrid';
import { styled } from '../Theme';
import { Icon } from '../Icon';

import { PropFilterWithFilterPropFn, SearchBarProps } from './types';

const propFilter: PropFilterWithFilterPropFn = (
  data,
  { queryFilterProp, query, currentTabValue, tabFilterProp },
) => {
  const q = query.toLowerCase();

  return data.filter(item => {
    if (
      query &&
      queryFilterProp &&
      !item[queryFilterProp].toLowerCase().includes(q)
    ) {
      return false;
    }

    if (
      currentTabValue &&
      tabFilterProp &&
      item[tabFilterProp] !== currentTabValue
    ) {
      return false;
    }

    return true;
  });
};

const Container = styled.div``;

export const SearchBar: React.FC<SearchBarProps> = ({
  tabs,
  data,
  queryFilterProp,
  className,
  render,
  filter,
  ...inputProps
}) => {
  const [stateQuery, setStateQuery] = useState('');
  const query = 'value' in inputProps ? inputProps.value || '' : stateQuery;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStateQuery(event.currentTarget.value);
    // ⬇ this is needed because of eslint bug?
    // eslint-disable-next-line no-unused-expressions
    inputProps.onChange?.(event);
  };

  const currentTabValue =
    (typeof tabs?.selected === 'number' &&
      tabs.tabs[tabs.selected]?.filterValue) ||
    '';
  const tabFilterProp = tabs?.filterProp;

  const icon = <Icon icon="IoMdSearch" className="icon" />;

  const filteredData: DataRows<any>[] = filter
    ? filter(data || [], { query, currentTabValue, tabFilterProp })
    : propFilter(data || [], {
        queryFilterProp,
        query,
        currentTabValue,
        tabFilterProp,
      });

  return (
    <Container className={className || ''}>
      <Input
        prefix={icon}
        {...inputProps}
        value={query}
        onChange={handleChange}
      />
      {render &&
        render({
          filteredData,
          query,
        })}
    </Container>
  );
};
