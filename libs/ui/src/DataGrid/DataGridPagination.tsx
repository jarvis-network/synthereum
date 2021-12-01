import React, { useEffect, useState } from 'react';

import { Button } from '../Button';
import { Select } from '../Select';
import { styled } from '../Theme';

const PaginationWrapper = styled.div`
  align-items: center;
  display: grid;
  grid-template-columns: 1fr max-content;
`;

const PaginationContainer = styled.div`
  align-items: center;
  border: 0 !important;
  box-shadow: none !important;
  display: grid !important;
  font-size: ${props => props.theme.font.sizes.xs};
  grid-template-columns: auto auto auto;
  height: auto !important;
  justify-content: center !important;
  justify-items: center;
  margin-left: 50px;
  padding: 0;

  .btn {
    font-size: ${props => props.theme.font.sizes.xs};
    border-radius: ${props => props.theme.borderRadius.xs};
    min-width: 60px;
    opacity: 0.9;
    padding: 6px 2px 7px !important;
    text-align: center;
    width: max-content;
  }

  .btn.disabled {
    box-shadow: none;
  }

  .center {
    justify-content: center;

    .page-info {
      color: ${props => props.theme.gray.gray400};
      margin: 0 23px !important;

      input {
        background-color: ${props => props.theme.background.primary};
        border: 1px solid ${props => props.theme.border.primary};
        border-radius: ${props => props.theme.borderRadius.xs};
        color: ${props => props.theme.text.medium};
        font-size: ${props => props.theme.font.sizes.xs};
        height: 25px;
        margin: 0 9px;
        outline: none;
        padding: 0;
        text-align: center;
        width: 25px !important;

        &::-webkit-inner-spin-button {
          appearance: none !important;
        }
      }
    }
  }
`;

const PaginationSelect = styled.div`
  align-items: center;
  display: flex;
  width: 160px;
`;

const SelectLabel = styled.span`
  color: ${props => props.theme.gray.gray400};
  display: inline-block;
  font-size: ${props => props.theme.font.sizes.xs};
  padding-right: 6px;
`;

const defaultButton = ({ children, ...props }: { children: any }) => (
  <Button type="dark" {...props}>
    {children}
  </Button>
);

const DataGridPagination = (props: any) => {
  const { page: propsPage, pages: propsPages } = props;
  const [page, setPage] = useState(propsPage);

  useEffect(() => {
    setPage(propsPage);
  }, [props]);

  const getSafePage = (pageNumber: number | any) => {
    let pNumber = pageNumber;
    if (Number.isNaN(pageNumber)) {
      pNumber = propsPage;
    }
    if (props.canNextFromData) return pNumber;

    return Math.min(Math.max(pNumber, 0), propsPages - 1);
  };

  const changePage = (pageNumber: number) => {
    const pNumber = getSafePage(pageNumber);
    setPage(pNumber);
    if (propsPage !== pNumber) {
      props.onPageChange(pNumber);
    }
  };

  const applyPage = (e: any) => {
    if (e) {
      e.preventDefault();
    }
    changePage(page === '' ? propsPage : page);
  };

  const {
    // Computed
    pages,
    // Props
    showPageSizeOptions,
    pageSizeOptions,
    pageSize,
    data,
    style,
    previousText,
    showPageJump,
    canPrevious,
    canNext: propsCanNext,
    canNextFromData,
    onPageSizeChange,
    className,
    PreviousComponent = defaultButton,
    NextComponent = defaultButton,
    showTotalPages = true,
    pageText,
    ofText,
    nextText,
    rowsText,
  } = props;

  const canNext = canNextFromData
    ? data && data.length === pageSize
    : propsCanNext;

  return (
    <PaginationWrapper className={className || ''} style={style}>
      <PaginationContainer>
        <div className="previous">
          <PreviousComponent
            onClick={() => {
              if (!canPrevious) return;
              changePage(page - 1);
            }}
            disabled={!canPrevious}
            className="btn"
          >
            {previousText}
          </PreviousComponent>
        </div>

        <div className="center">
          <div className="page-info">
            {pageText}{' '}
            {showPageJump ? (
              <input
                type={page === '' ? 'text' : 'number'}
                onChange={e => {
                  const val: any = e.target.value;
                  const pageNumber = val - 1;
                  if (val === '') {
                    return setPage(getSafePage(val));
                  }
                  return setPage(getSafePage(pageNumber));
                }}
                value={page === '' ? '' : page + 1}
                onBlur={applyPage}
                onKeyPress={e => {
                  if (e.which === 13 || e.keyCode === 13) {
                    applyPage(e);
                  }
                }}
              />
            ) : (
              <span className="currentPage">{page + 1}</span>
            )}{' '}
            {showTotalPages ? (
              <>
                {ofText} <span className="totalPages">{pages || 1}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="next">
          <NextComponent
            onClick={() => {
              if (!canNext) return;
              changePage(page + 1);
            }}
            className="btn"
            disabled={!canNext}
          >
            {nextText}
          </NextComponent>
        </div>
      </PaginationContainer>
      {showPageSizeOptions && (
        <PaginationSelect>
          <SelectLabel>Display</SelectLabel>
          <Select
            selected={pageSize}
            onChange={(e: any) => {
              onPageSizeChange(e.value);
            }}
            rowsText={rowsText}
            options={pageSizeOptions}
          />
        </PaginationSelect>
      )}
    </PaginationWrapper>
  );
};

export default DataGridPagination;
