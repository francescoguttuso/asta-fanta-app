import { useRef } from 'react';
import { useAdminAuctionContext } from '../context/useAuctionContexts';

export default function TeamImportExport() {
  const { esportaInExcel, importaSquadre } = useAdminAuctionContext();
  const inputRef = useRef(null);

  return (
    <div
      className="card"
      style={{
        marginTop: '12px',
        marginBottom: '12px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <strong style={{ color: '#e2e8f0' }}>Gestione squadre</strong>
        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '3px' }}>
          Esporta o reimporta rose e crediti della sessione.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={esportaInExcel}>
          📤 ESPORTA SQUADRE
        </button>

        <button
          type="button"
          className="btn btn-green"
          onClick={() => inputRef.current?.click()}
        >
          📥 IMPORTA SQUADRE
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={importaSquadre}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
