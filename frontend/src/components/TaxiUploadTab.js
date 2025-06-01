import React, { useState } from 'react';

const TaxiUploadTab = ({ onUpload, loading }) => {
  const [items, setItems] = useState([]);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      try {
        const workbook = window.XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = window.XLSX.utils.sheet_to_json(sheet);
        setItems(json);
      } catch (err) {
        alert('엑셀 파일을 읽는 데 실패했습니다.');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleUpload = () => {
    if (!items.length) {
      alert('업로드할 데이터가 없습니다.');
      return;
    }
    onUpload(items);
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-900"
        />
        {fileName && (
          <p className="text-sm text-gray-600 mt-2">
            {fileName} - {items.length} rows
          </p>
        )}
      </div>
      <button
        onClick={handleUpload}
        disabled={loading || !items.length}
        className="px-4 py-2 bg-yellow-500 text-white rounded-xl disabled:opacity-50"
      >
        업로드
      </button>
    </div>
  );
};

export default TaxiUploadTab;
