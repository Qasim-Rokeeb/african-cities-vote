import React from 'react';
import styles from './StatusMessage.module.css';

export default function StatusMessage({ message, type }) {
  if (!message) return null;
  return (
    <div className={[styles.status, styles[type] || ''].join(' ')}
         dangerouslySetInnerHTML={{ __html: message }} />
  );
}
