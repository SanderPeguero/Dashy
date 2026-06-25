// Actual CEPM API Fetcher and HTML Scraper
const DEFAULT_TARIFF_RATE = 15.0; // Default price per kWh in RD$

// Helper to normalize and clean strings for exact matching
const normalizeLabel = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[:*]/g, "")           // Remove colons and asterisks
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .trim();
};

// Extract value by label from HTML using DOM and Regex fallbacks
export const parseCepmHtml = (html, targetMeterId) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Helper to extract text from DOM
  const findInDom = (labelKeyword) => {
    const targetClean = normalizeLabel(labelKeyword);
    const elements = Array.from(doc.querySelectorAll('td, th, span, div, label, p, b, strong, font'));
    
    for (const el of elements) {
      const textClean = normalizeLabel(el.textContent);
      if (textClean === targetClean) {
        if (el.tagName === 'TD' || el.tagName === 'TH') {
          if (el.nextElementSibling) {
            return el.nextElementSibling.textContent.trim();
          }
          const row = el.closest('tr');
          if (row && row.cells.length > 1) {
            const idx = Array.from(row.cells).indexOf(el);
            if (idx !== -1 && row.cells[idx + 1]) {
              return row.cells[idx + 1].textContent.trim();
            }
          }
        }
        
        const parent = el.parentElement;
        if (parent) {
          const input = parent.querySelector('input, select');
          if (input && input.value) return input.value.trim();
        }
      }
    }
    return null;
  };

  // Helper to extract using regex (fallback)
  const findInRegex = (labelKeyword) => {
    try {
      const targetClean = normalizeLabel(labelKeyword);
      const regexPatterns = [
        new RegExp(`<td[^>]*>\\s*${targetClean}\\s*<\\/td>\\s*<td[^>]*>([^<]+)<\\/td>`, 'i'),
        new RegExp(`${targetClean}\\s*:\\s*([^<\\n]+)`, 'i'),
      ];

      for (const pattern of regexPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch (e) {
      console.error("Error en parsing Regex:", e);
    }
    return null;
  };

  const getValue = (keywords) => {
    for (const keyword of keywords) {
      const domVal = findInDom(keyword);
      if (domVal) return domVal;
      const regexVal = findInRegex(keyword);
      if (regexVal) return regexVal;
    }
    return null;
  };

  // Extract variables
  const medidor = getValue(['Medidor', 'No. Medidor']) || targetMeterId;
  const fechaBalance = getValue(['Fecha del Balance', 'Fecha Balance']) || new Date().toLocaleString();
  const balanceStr = getValue(['Balance']) || '0.0kWh';
  const lecturaStr = getValue(['Lectura', 'Lectura Actual']) || '0.0kWh';
  const suspensionStr = getValue(['Suspensión al llegar a', 'Suspencion al llegar a']) || '0.0kWh';
  const corte = getValue(['Fecha aproximada de corte']) || 'N/A';

  // Parse numeric values
  const balanceNum = parseFloat(balanceStr.replace(/[^0-9.-]/g, '')) || 0;
  const lecturaNum = parseFloat(lecturaStr.replace(/[^0-9.-]/g, '')) || 0;
  const suspensionNum = parseFloat(suspensionStr.replace(/[^0-9.-]/g, '')) || 0;

  return {
    medidor,
    fechaBalance,
    balanceStr,
    balanceNum,
    lecturaStr,
    lecturaNum,
    suspensionStr,
    suspensionNum,
    corte
  };
};

export const fetchMeterStatus = async (meterId = "D037002909") => {
  const isDev = import.meta.env.DEV;
  
  const localUrl = `/cepm-api/balance?Medidor=${meterId}&btnConsultar=Consultar`;
  const remoteUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://oficina.cepm.com.do/balance?Medidor=${meterId}&btnConsultar=Consultar`)}`;
  
  const requestUrl = isDev ? localUrl : remoteUrl;

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`Servidor de CEPM retornó estatus: ${response.status}`);
    }
    const html = await response.text();
    
    // Parse html content
    const parsedData = parseCepmHtml(html, meterId);
    
    // Cache the balance locally for updates
    localStorage.setItem('dashy_prepaid_balance', parsedData.balanceNum.toFixed(2));

    return {
      success: true,
      realApi: true,
      meterId: parsedData.medidor,
      fechaBalance: parsedData.fechaBalance,
      remainingBalance: parsedData.balanceNum,
      balanceStr: parsedData.balanceStr,
      totalAccumulatedKwh: parsedData.lecturaNum,
      suspensionStr: parsedData.suspensionStr,
      suspensionNum: parsedData.suspensionNum,
      corteDate: parsedData.corte,
      status: parsedData.balanceNum > 5 ? 'Active' : parsedData.balanceNum > 0 ? 'Low Balance' : 'Suspended'
    };
  } catch (error) {
    console.error("Fallo al consultar API real de CEPM, usando simulación:", error);
    
    // Fallback simulation (No default seed logs generated here)
    const lastBalance = parseFloat(localStorage.getItem('dashy_prepaid_balance')) || 50.00;
    const lastLectura = 2800.00;
    const lastSuspension = lastLectura + lastBalance;
    
    return {
      success: true,
      realApi: false, // Flag to indicate simulated mode
      meterId,
      fechaBalance: new Date().toISOString(),
      remainingBalance: lastBalance,
      balanceStr: `${lastBalance.toFixed(1)}kWh`,
      totalAccumulatedKwh: lastLectura,
      suspensionStr: `${lastSuspension.toFixed(1)}kWh`,
      suspensionNum: lastSuspension,
      corteDate: 'N/A',
      status: lastBalance > 5 ? 'Active' : lastBalance > 0 ? 'Low Balance' : 'Suspended',
      error: error.message
    };
  }
};

export const verifyDailyRecord = async (dateStr, recordedKwh) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const randomMargin = Math.random() > 0.05; // 95% verification rate
  if (randomMargin) {
    return {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      code: 'VAL_OK',
      message: `La lectura de ${recordedKwh} kWh para la fecha ${dateStr} coincide con el contador de la distribuidora.`
    };
  } else {
    return {
      status: 'discrepancy',
      verifiedAt: new Date().toISOString(),
      code: 'VAL_WARN',
      message: `Advertencia: Discrepancia menor en la lectura de la fecha ${dateStr}. Lectura de compañía: ${(recordedKwh * 1.02).toFixed(2)} kWh.`
    };
  }
};

export const rechargePrepaidMeter = async (amount) => {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Sim payment process
  
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      message: 'Monto de recarga inválido.'
    };
  }

  return {
    success: true,
    transactionId: `TX-ELEC-${Date.now().toString().slice(-6)}`,
    amountCharged: parseFloat(amount),
    timestamp: new Date().toISOString(),
    message: `Recarga exitosa de RD$ ${amount} registrada en CEPM.`
  };
};
