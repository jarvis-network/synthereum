import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const labelStyle = {
  cursor: 'default',
  height: '20px',
  display: 'inline-flex',
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 8,
  paddingRight: 8,
  flexGrow: 0,
  fontSize: '0.75rem',
  minWidth: '20px',
  alignItems: 'center',
  flexShrink: 0,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  borderRadius: '2px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  justifyContent: 'center',
};

const useStyles = makeStyles({
  root: props =>
    props.status === 'rejected'
      ? {
          ...labelStyle,
          color: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.08)',
        }
      : props.status === 'approved'
      ? {
          ...labelStyle,
          color: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.08)',
        }
      : {
          ...labelStyle,
          color: '#ff9800',
          backgroundColor: 'rgba(255, 152, 0, 0.08)',
        },
});

const StatusLabel = props => {
  const classes = useStyles(props);

  const labels = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return <span className={classes.root}>{labels[props.status]}</span>;
};

export default StatusLabel;
