import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  TrendingUp, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Clock, 
  Database, 
  CheckCircle2, 
  Settings, 
  AlertTriangle, 
  CreditCard, 
  ArrowUpRight, 
  Activity, 
  FileText,
  Sparkles,
  Sliders,
  ChevronDown,
  PlusCircle,
  HelpCircle,
  Coins
} from 'lucide-react';
import { db, isConfigValid, config as firebaseConfig } from './firebase';
import { collection, doc, getDocs, setDoc, query, orderBy } from 'firebase/firestore';
import { fetchMeterStatus, rechargePrepaidMeter } from './services/electricityApi';

// ==========================================
// DATABASE FALLBACK LAYER (CLEAN OF MOCK DATA)
// ==========================================
const getLocalReadings = (meterId) => {
  const data = localStorage.getItem(`dashy_readings_${meterId}`);
  return data ? JSON.parse(data) : []; // Empty array if no readings exist
};

const getLocalRefills = (meterId) => {
  const data = localStorage.getItem(`dashy_refills_${meterId}`);
  return data ? JSON.parse(data) : []; // Empty array if no refills exist
};

const getLocalMeterList = () => {
  const data = localStorage.getItem('dashy_meter_list');
  if (data) return JSON.parse(data);
  
  const defaultList = ['D037002909'];
  localStorage.setItem('dashy_meter_list', JSON.stringify(defaultList));
  return defaultList;
};

export default function App() {
  // Configurable Tariff Rate in Dominican Pesos (RD$)
  const [tariffRate, setTariffRate] = useState(() => {
    const initialMeter = localStorage.getItem('dashy_meter_id') || 'D037002909';
    return parseFloat(localStorage.getItem(`dashy_tariff_rate_${initialMeter}`) || '15.00');
  });

  // Suggested tariff rate banner state
  const [suggestedTariff, setSuggestedTariff] = useState(null);

  // App states
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Inicializando...');
  const [meterStatus, setMeterStatus] = useState(null);
  const [readings, setReadings] = useState([]);
  const [refills, setRefills] = useState([]);
  const [activeChartTab, setActiveChartTab] = useState('daily'); // default to daily
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillAmount, setRefillAmount] = useState('');
  const [kwhReceivedInput, setKwhReceivedInput] = useState(''); // user input for rate calculation
  const [refillLoading, setRefillLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Multi-meter states
  const [meterList, setMeterList] = useState([]);
  const [currentMeterId, setCurrentMeterId] = useState(() => {
    return localStorage.getItem('dashy_meter_id') || 'D037002909';
  });
  const [showAddMeterModal, setShowAddMeterModal] = useState(false);
  const [newMeterIdInput, setNewMeterIdInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Verification state on load
  const [verificationResult, setVerificationResult] = useState({
    checked: false,
    status: 'checking', // checking | verified | warning | failed
    message: ''
  });

  // Firebase Config Form state
  const [fbApiKey, setFbApiKey] = useState(firebaseConfig.apiKey || '');
  const [fbProjectId, setFbProjectId] = useState(firebaseConfig.projectId || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(firebaseConfig.authDomain || '');
  const [fbStorageBucket, setFbStorageBucket] = useState(firebaseConfig.storageBucket || '');
  const [fbAppId, setFbAppId] = useState(firebaseConfig.appId || '');

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save tariff rate changes
  const saveTariffRate = async (rate) => {
    const parsed = parseFloat(rate);
    if (!isNaN(parsed) && parsed > 0) {
      setTariffRate(parsed);
      localStorage.setItem(`dashy_tariff_rate_${currentMeterId}`, parsed.toFixed(2));
      
      // Update meter metadata doc in Firestore to sync tariff rate
      if (isConfigValid && db) {
        try {
          await setDoc(doc(db, 'meters', currentMeterId), { 
            meterId: currentMeterId, 
            tariffRate: parsed,
            lastUpdated: new Date().toISOString() 
          });
        } catch (err) {
          console.error("Error storing meter metadata in Firestore:", err);
        }
      }

      // Update existing readings cost in state and DB using the updated rate
      const updated = readings.map(r => ({
        ...r,
        cost: parseFloat((r.kwhConsumed * parsed).toFixed(2)),
        tariffRate: parsed
      }));
      setReadings(updated);
      
      // Write back updated readings to store
      localStorage.setItem(`dashy_readings_${currentMeterId}`, JSON.stringify(updated));
      if (isConfigValid && db) {
        updated.forEach(async (r) => {
          await setDoc(doc(db, 'meters', currentMeterId, 'readings', r.date), r).catch(console.error);
        });
      }
    }
  };

  // ==========================================
  // INITIALIZATION AND LOAD TIME VERIFICATION
  // ==========================================
  const loadDashboardData = async (targetMeterId, isRefresh = false) => {
    try {
      let activeTariff = parseFloat(localStorage.getItem(`dashy_tariff_rate_${targetMeterId}`) || '15.00');

      // If not refreshing the same meter, clear the current readings/refills to avoid showing stale data from the previous meter
      if (!isRefresh) {
        setReadings([]);
        setRefills([]);
        setTariffRate(activeTariff);
        setMeterStatus({
          success: true,
          realApi: false,
          meterId: targetMeterId,
          fechaBalance: 'Cargando...',
          remainingBalance: 0,
          balanceStr: 'Cargando...',
          totalAccumulatedKwh: 0,
          suspensionStr: 'Cargando...',
          suspensionNum: 0,
          corteDate: 'Cargando...',
          status: 'checking'
        });
      }

      // Show full screen splash loader only if it's the absolute first load of the application
      const isInitialAppLoad = readings.length === 0 && meterList.length === 0 && !isRefresh;
      if (isInitialAppLoad) {
        setLoading(true);
      }
      
      setSuggestedTariff(null);
      setVerificationResult({
        checked: false,
        status: 'checking',
        message: 'Cargando datos locales y Firebase...'
      });

      // Stage 1: Connect to Database (Firebase or Local fallback)
      setLoadingStage(isConfigValid ? 'Estableciendo conexión con Firebase Firestore...' : 'Cargando base de datos local...');
      
      let fetchedReadings = [];
      let fetchedRefills = [];
      let fetchedMeterList = [];
      
      if (isConfigValid && db) {
        try {
          // Fetch meter list
          const metersCol = collection(db, 'meters');
          const metersSnapshot = await getDocs(metersCol);
          fetchedMeterList = metersSnapshot.docs.map(doc => doc.id);
          
          const meterDoc = metersSnapshot.docs.find(doc => doc.id === targetMeterId);
          if (meterDoc) {
            const meterData = meterDoc.data();
            if (meterData && typeof meterData.tariffRate === 'number') {
              activeTariff = meterData.tariffRate;
              localStorage.setItem(`dashy_tariff_rate_${targetMeterId}`, activeTariff.toFixed(2));
            }
          } else {
            await setDoc(doc(db, 'meters', targetMeterId), { 
              meterId: targetMeterId, 
              tariffRate: activeTariff,
              lastUpdated: new Date().toISOString() 
            });
            if (!fetchedMeterList.includes(targetMeterId)) {
              fetchedMeterList.push(targetMeterId);
            }
          }

          // Fetch readings
          const readingsCol = collection(db, 'meters', targetMeterId, 'readings');
          const q = query(readingsCol, orderBy('date', 'desc'));
          const readingsSnapshot = await getDocs(q);
          fetchedReadings = readingsSnapshot.docs.map(doc => doc.data());

          // Fetch refills
          const refillsCol = collection(db, 'meters', targetMeterId, 'refills');
          const refillsSnapshot = await getDocs(refillsCol);
          fetchedRefills = refillsSnapshot.docs.map(doc => doc.data());
        } catch (fsError) {
          console.error("Error fetching from Firestore, falling back to LocalStorage:", fsError);
          fetchedReadings = getLocalReadings(targetMeterId);
          fetchedRefills = getLocalRefills(targetMeterId);
          fetchedMeterList = getLocalMeterList();
        }
      } else {
        fetchedReadings = getLocalReadings(targetMeterId);
        fetchedRefills = getLocalRefills(targetMeterId);
        fetchedMeterList = getLocalMeterList();
      }

      // If requested meter is not in list, register it
      if (!fetchedMeterList.includes(targetMeterId)) {
        fetchedMeterList.push(targetMeterId);
        if (isConfigValid && db) {
          await setDoc(doc(db, 'meters', targetMeterId), { 
            meterId: targetMeterId, 
            tariffRate: activeTariff,
            lastUpdated: new Date().toISOString() 
          });
        }
        localStorage.setItem('dashy_meter_list', JSON.stringify(fetchedMeterList));
      }

      const sortedHistory = [...fetchedReadings].sort((a, b) => b.date.localeCompare(a.date));
      const sortedRefills = [...fetchedRefills].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      setMeterList(fetchedMeterList);
      setTariffRate(activeTariff);
      setReadings(sortedHistory);
      setRefills(sortedRefills);

      // Initialize meter status state with latest known record so user sees immediate results
      if (sortedHistory.length > 0) {
        const latest = sortedHistory[0];
        setMeterStatus({
          success: true,
          realApi: true,
          meterId: targetMeterId,
          fechaBalance: latest.fechaBalance,
          remainingBalance: latest.balanceKwh,
          balanceStr: `${latest.balanceKwh.toFixed(1)} kWh`,
          totalAccumulatedKwh: latest.lecturaKwh,
          suspensionStr: `${latest.suspensionKwh.toFixed(1)} kWh`,
          suspensionNum: latest.suspensionKwh,
          corteDate: latest.corteDate,
          status: latest.balanceKwh > 5 ? 'Active' : latest.balanceKwh > 0 ? 'Low Balance' : 'Suspended'
        });
      } else {
        setMeterStatus({
          success: true,
          realApi: false,
          meterId: targetMeterId,
          fechaBalance: 'N/A',
          remainingBalance: 0,
          balanceStr: '0.0 kWh',
          totalAccumulatedKwh: 0,
          suspensionStr: '0.0 kWh',
          suspensionNum: 0,
          corteDate: 'N/A',
          status: 'Suspended'
        });
      }

      // Disappear loading screen instantly as the local/cached data is now rendered
      setLoading(false);

      // Stage 2: Sync in background with power company
      setVerificationResult({
        checked: true,
        status: 'syncing',
        message: 'Sincronizando últimas mediciones en vivo con CEPM...'
      });

      try {
        const apiStatus = await fetchMeterStatus(targetMeterId);
        
        if (!apiStatus.realApi) {
          setVerificationResult({
            checked: true,
            status: 'warning',
            message: `No se pudo conectar con CEPM. Mostrando últimos datos sincronizados.`
          });
          return;
        }

        setMeterStatus(apiStatus);

        const isAlreadyLogged = sortedHistory.some(r => r.fechaBalance === apiStatus.fechaBalance);

        if (isAlreadyLogged) {
          setVerificationResult({
            checked: true,
            status: 'verified',
            message: `Lectura sincronizada y al día. Saldo: ${apiStatus.remainingBalance} kWh.`
          });
        } else {
          const todayStr = new Date().toISOString().split('T')[0];
          const previousDayRecord = sortedHistory.find(r => r.date !== todayStr);
          let kwhConsumed = 0;
          if (previousDayRecord && apiStatus.totalAccumulatedKwh > 0 && previousDayRecord.lecturaKwh > 0) {
            kwhConsumed = parseFloat((apiStatus.totalAccumulatedKwh - previousDayRecord.lecturaKwh).toFixed(2));
          }
          kwhConsumed = Math.max(0, kwhConsumed);
          const cost = parseFloat((kwhConsumed * activeTariff).toFixed(2));

          const todayRecord = {
            date: todayStr,
            timestamp: new Date().toISOString(),
            fechaBalance: apiStatus.fechaBalance,
            meterId: targetMeterId,
            balanceKwh: apiStatus.remainingBalance,
            lecturaKwh: apiStatus.totalAccumulatedKwh > 0 ? apiStatus.totalAccumulatedKwh : (previousDayRecord?.lecturaKwh || 0),
            suspensionKwh: apiStatus.suspensionNum,
            corteDate: apiStatus.corteDate,
            kwhConsumed: kwhConsumed,
            cost: cost,
            tariffRate: activeTariff,
            verified: true
          };

          if (isConfigValid && db) {
            await setDoc(doc(db, 'meters', targetMeterId, 'readings', todayStr), todayRecord).catch(console.error);
          }
          
          const localReadings = getLocalReadings(targetMeterId);
          const updatedLocal = [todayRecord, ...localReadings.filter(r => r.date !== todayStr)];
          localStorage.setItem(`dashy_readings_${targetMeterId}`, JSON.stringify(updatedLocal));
          
          const newlySorted = [...updatedLocal].sort((a, b) => b.date.localeCompare(a.date));
          setReadings(newlySorted);

          // Auto-detect recharge tariff suggestion
          if (sortedHistory.length > 0 && apiStatus.remainingBalance > sortedHistory[0].balanceKwh) {
            const kwhDiff = apiStatus.remainingBalance - sortedHistory[0].balanceKwh;
            if (sortedRefills.length > 0 && kwhDiff > 1) {
              const latestRefill = sortedRefills[0];
              const estimatedRate = parseFloat((latestRefill.amount / kwhDiff).toFixed(2));
              if (estimatedRate > 0 && estimatedRate < 100) {
                setSuggestedTariff({
                  rate: estimatedRate,
                  amount: latestRefill.amount,
                  kwh: kwhDiff
                });
              }
            }
          }

          setVerificationResult({
            checked: true,
            status: 'verified',
            message: `Sincronización exitosa. Nueva lectura de hoy registrada (${kwhConsumed} kWh).`
          });
        }
      } catch (apiError) {
        console.error("Error connecting to CEPM in background:", apiError);
        setVerificationResult({
          checked: true,
          status: 'warning',
          message: 'No se pudo conectar con CEPM. Mostrando últimos datos sincronizados.'
        });
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setVerificationResult({
        checked: true,
        status: 'failed',
        message: 'Error crítico al inicializar base de datos.'
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(currentMeterId);
  }, [currentMeterId]);

  // ==========================================
  // ADD NEW METER SUBMISSION
  // ==========================================
  const handleAddNewMeter = async (e) => {
    e.preventDefault();
    const cleanId = newMeterIdInput.trim();
    if (!cleanId) return;

    try {
      setLoading(true);
      setShowAddMeterModal(false);
      
      const updatedList = [...meterList];
      if (!updatedList.includes(cleanId)) {
        updatedList.push(cleanId);
        if (isConfigValid && db) {
          await setDoc(doc(db, 'meters', cleanId), { 
            meterId: cleanId, 
            tariffRate: 15.00,
            lastUpdated: new Date().toISOString() 
          });
        }
        localStorage.setItem(`dashy_tariff_rate_${cleanId}`, '15.00');
        localStorage.setItem('dashy_meter_list', JSON.stringify(updatedList));
      }
      
      setMeterList(updatedList);
      setNewMeterIdInput('');
      
      localStorage.setItem('dashy_meter_id', cleanId);
      setCurrentMeterId(cleanId);
    } catch (err) {
      console.error("Error adding meter:", err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RECHARGE BALANCE ACTION
  // ==========================================
  const handleRecharge = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(refillAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    try {
      setRefillLoading(true);
      const result = await rechargePrepaidMeter(parsedAmount);

      if (result.success) {
        // Calculate dynamic kWh received
        let kwhAdded = 0;
        let calculatedRate = tariffRate;
        const parsedKwhInput = parseFloat(kwhReceivedInput);

        if (!isNaN(parsedKwhInput) && parsedKwhInput > 0) {
          // If user typed the exact kWh credited
          kwhAdded = parsedKwhInput;
          calculatedRate = parseFloat((parsedAmount / parsedKwhInput).toFixed(2));
          // Suggest this new rate to the user
          setSuggestedTariff({
            rate: calculatedRate,
            amount: parsedAmount,
            kwh: parsedKwhInput
          });
        } else {
          // Otherwise, estimate kWh based on current rate setting
          kwhAdded = parseFloat((parsedAmount / tariffRate).toFixed(2));
        }

        const newBalance = (meterStatus?.remainingBalance || 0) + kwhAdded;

        // Update active status
        setMeterStatus(prev => ({
          ...prev,
          remainingBalance: newBalance,
          balanceStr: `${newBalance.toFixed(1)}kWh`
        }));

        const newRefillRecord = {
          id: result.transactionId,
          timestamp: result.timestamp,
          amount: parsedAmount, // RD$
          kwhEquivalent: kwhAdded
        };

        if (isConfigValid && db) {
          try {
            await setDoc(doc(db, 'meters', currentMeterId, 'refills', result.transactionId), newRefillRecord);
          } catch (fsErr) {
            console.error("Error saving refill to Firestore:", fsErr);
          }
        }
        
        const localRefills = getLocalRefills(currentMeterId);
        const updatedRefills = [newRefillRecord, ...localRefills];
        localStorage.setItem(`dashy_refills_${currentMeterId}`, JSON.stringify(updatedRefills));
        setRefills(updatedRefills);

        // Update readings list (adding new balance)
        const todayStr = new Date().toISOString().split('T')[0];
        const updatedReadings = readings.map(r => {
          if (r.date === todayStr) {
            const updatedToday = { ...r, balanceKwh: newBalance };
            if (isConfigValid && db) {
              setDoc(doc(db, 'meters', currentMeterId, 'readings', todayStr), updatedToday).catch(console.error);
            }
            return updatedToday;
          }
          return r;
        });
        
        localStorage.setItem(`dashy_readings_${currentMeterId}`, JSON.stringify(updatedReadings));
        setReadings(updatedReadings);

        setRefillAmount('');
        setKwhReceivedInput('');
        setShowRefillModal(false);
        
        setVerificationResult({
          checked: true,
          status: 'verified',
          message: `¡Recarga de RD$ ${parsedAmount.toLocaleString()} registrada. Acreditados +${kwhAdded.toFixed(1)} kWh al medidor!`
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefillLoading(false);
    }
  };

  // ==========================================
  // CONFIGURATION FORM SUBMISSION
  // ==========================================
  const handleSaveFirebaseConfig = (e) => {
    e.preventDefault();
    if (!fbApiKey || !fbProjectId) {
      alert("Por favor, introduce al menos la clave de API y el ID de Proyecto.");
      return;
    }

    const newConfig = {
      apiKey: fbApiKey,
      projectId: fbProjectId,
      authDomain: fbAuthDomain,
      storageBucket: fbStorageBucket,
      appId: fbAppId
    };

    localStorage.setItem('dashy_firebase_config', JSON.stringify(newConfig));
    alert("Configuración de Firebase guardada con éxito. Recargando la aplicación...");
    window.location.reload();
  };

  const handleClearFirebaseConfig = () => {
    localStorage.removeItem('dashy_firebase_config');
    alert("Credenciales eliminadas. Volviendo a la base de datos simulada local. Recargando...");
    window.location.reload();
  };

  // ==========================================
  // DYNAMIC CHART DATA COMPILATION
  // ==========================================
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = readings.find(r => r.date === todayStr);
  const todayKwh = todayRecord ? todayRecord.kwhConsumed : 0;
  const todayCost = todayRecord ? todayRecord.cost : 0;

  const getChartData = () => {
    const sortedChronological = [...readings].reverse(); // oldest first

    if (activeChartTab === 'daily') {
      // DÍA COMPARA DÍAS: Historial de consumo por días (últimos 15 días)
      const daysToDisplay = sortedChronological.slice(-15);
      return {
        labels: daysToDisplay.length > 0 ? daysToDisplay.map(r => r.date.slice(-5)) : ['Sin datos'],
        values: daysToDisplay.length > 0 ? daysToDisplay.map(r => r.kwhConsumed) : [0],
        max: daysToDisplay.length > 0 ? Math.max(...daysToDisplay.map(r => r.kwhConsumed), 5) : 5,
        title: 'Comparativa de Consumo por Día (kWh)'
      };
    } else if (activeChartTab === 'monthly') {
      // MES COMPARA MESES: Consumo mensual agrupado por mes (últimos 12 meses)
      const monthlyGroups = {};
      sortedChronological.forEach(r => {
        const monthKey = r.date.slice(0, 7); // YYYY-MM
        monthlyGroups[monthKey] = (monthlyGroups[monthKey] || 0) + r.kwhConsumed;
      });

      const keys = Object.keys(monthlyGroups).sort().slice(-12);
      const monthNames = {
        '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
      };

      const labels = keys.length > 0 ? keys.map(k => {
        const parts = k.split('-');
        const monthNum = parts[1];
        const yearShort = parts[0].slice(-2);
        return `${monthNames[monthNum] || monthNum} '${yearShort}`;
      }) : ['Sin datos'];

      const values = keys.length > 0 ? keys.map(k => parseFloat(monthlyGroups[k].toFixed(2))) : [0];

      return {
        labels,
        values,
        max: keys.length > 0 ? Math.max(...values, 10) : 10,
        title: 'Comparativa de Consumo por Mes (kWh)'
      };
    } else {
      // AÑO COMPARA AÑOS: Consumo anual agrupado por año
      const yearlyGroups = {};
      sortedChronological.forEach(r => {
        const yearKey = r.date.slice(0, 4); // YYYY
        yearlyGroups[yearKey] = (yearlyGroups[yearKey] || 0) + r.kwhConsumed;
      });

      const keys = Object.keys(yearlyGroups).sort();
      const labels = keys.length > 0 ? keys : ['Sin datos'];
      const values = keys.length > 0 ? keys.map(k => parseFloat(yearlyGroups[k].toFixed(2))) : [0];

      return {
        labels,
        values,
        max: keys.length > 0 ? Math.max(...values, 20) : 20,
        title: 'Comparativa de Consumo por Año (kWh)'
      };
    }
  };

  const chartData = getChartData();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-8 animate-bounce">
          <Zap className="w-6 h-6 text-white" />
        </div>

        <div className="flex flex-col items-center max-w-sm w-full text-center space-y-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
            <h2 className="text-lg font-bold text-white tracking-wide">Cargando Dashy Power</h2>
          </div>
          
          <div className="w-full bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest text-[9px] mb-1">Estatus del Check-in</p>
            <p className="text-xs font-medium text-zinc-400 italic">"{loadingStage}"</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans antialiased overflow-x-hidden relative pb-12">
      {/* Visual background lights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-20 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Main Header */}
      <header className="h-16 border-b border-[#222226] bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between px-6 md:px-12 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-xl bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-wide hidden sm:inline">
            Dashy Power
          </span>
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hidden md:inline">
            Medidor Inteligente
          </span>
        </div>

        {/* Premium Multi-Meter Selector Dropdown */}
        <div className="relative flex items-center" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#121214] border border-[#222226] hover:border-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm select-none"
          >
            <span className="text-[10px] text-zinc-500">Medidor:</span>
            <span>{currentMeterId}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2.5 w-60 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-3 duration-250">
              <div className="px-2.5 py-1.5 border-b border-zinc-900 mb-1.5">
                <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider">Selecciona Medidor</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {meterList.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      localStorage.setItem('dashy_meter_id', m);
                      setCurrentMeterId(m);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-all
                      ${m === currentMeterId 
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/15' 
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white border border-transparent'
                      }`}
                  >
                    <span>{m}</span>
                    {m === currentMeterId && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
              
              <div className="border-t border-zinc-900 mt-1.5 pt-1.5">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowAddMeterModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer bg-zinc-900"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Añadir Medidor</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5
            ${isConfigValid 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isConfigValid ? 'Firebase' : 'Simulación'}</span>
          </span>

          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-xl border border-[#222226] bg-[#121214] hover:bg-[#18181b] hover:text-white text-zinc-400 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 space-y-6 relative z-10">

        {/* Suggested Tariff Rate Banner */}
        {suggestedTariff && (
          <div className="p-4 border border-violet-500/20 bg-violet-500/5 glow-purple rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-violet-400 shrink-0" />
              <div className="text-xs font-semibold text-violet-300 font-sans">
                <span className="font-bold text-white uppercase tracking-wider mr-2">Estimación de Tarifa:</span>
                Detectamos una tarifa implícita de <span className="font-bold text-white">RD$ {suggestedTariff.rate.toFixed(2)} / kWh</span> en tu recarga de RD$ {suggestedTariff.amount.toLocaleString()} ({suggestedTariff.kwh.toFixed(0)} kWh).
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => {
                  saveTariffRate(suggestedTariff.rate);
                  setSuggestedTariff(null);
                }}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-violet-500/25"
              >
                Aplicar Tarifa
              </button>
              <button 
                onClick={() => setSuggestedTariff(null)}
                className="px-2.5 py-1.5 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold rounded-lg cursor-pointer"
              >
                Ignorar
              </button>
            </div>
          </div>
        )}

        {/* Verification Alert Banner */}
        {verificationResult.checked && (
          <div className={`p-4 border rounded-2xl flex items-start sm:items-center justify-between gap-4 transition-all duration-300 backdrop-blur-md
            ${verificationResult.status === 'verified' 
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 glow-emerald' 
              : verificationResult.status === 'syncing'
                ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400 glow-indigo'
                : verificationResult.status === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-400 glow-indigo'
                  : 'bg-red-500/5 border-red-500/20 text-red-400'}`}
          >
            <div className="flex items-center gap-3">
              {verificationResult.status === 'verified' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : verificationResult.status === 'syncing' ? (
                <RefreshCw className="w-5 h-5 shrink-0 animate-spin text-indigo-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <div className="text-xs font-semibold leading-relaxed font-sans">
                <span className="font-bold uppercase tracking-wider block sm:inline mr-2">
                  {verificationResult.status === 'syncing' ? 'Sincronizando:' : meterStatus?.realApi ? 'Conectado a CEPM:' : 'Simulando datos:'}
                </span>
                {verificationResult.message} {meterStatus?.error && <span className="text-[10px] text-zinc-500">({meterStatus.error})</span>}
              </div>
            </div>
            
            <button 
              onClick={() => loadDashboardData(currentMeterId, true)}
              className="p-1 rounded-lg border border-transparent hover:border-[#222226] bg-zinc-950/20 hover:bg-[#18181b] hover:text-white transition-all cursor-pointer shrink-0"
              title="Volver a verificar medidor"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Configuration Setup Panel */}
        {showConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* System config */}
            <form onSubmit={handleSaveFirebaseConfig} className="lg:col-span-2 p-6 bg-[#121214]/90 border border-zinc-800 rounded-2xl shadow-2xl space-y-4">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Conexión a Firebase
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Ingresa las credenciales del SDK de Firebase para sincronizar las lecturas en la nube.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">apiKey</label>
                  <input 
                    type="text" 
                    value={fbApiKey} 
                    onChange={(e) => setFbApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">projectId</label>
                  <input 
                    type="text" 
                    value={fbProjectId} 
                    onChange={(e) => setFbProjectId(e.target.value)} 
                    placeholder="mi-proyecto-123" 
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">authDomain</label>
                  <input 
                    type="text" 
                    value={fbAuthDomain} 
                    onChange={(e) => setFbAuthDomain(e.target.value)} 
                    placeholder="mi-proyecto.firebaseapp.com" 
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">appId</label>
                  <input 
                    type="text" 
                    value={fbAppId} 
                    onChange={(e) => setFbAppId(e.target.value)} 
                    placeholder="1:12345:web:abcd" 
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold" 
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-500/15"
                >
                  Conectar Firebase
                </button>
                {isConfigValid && (
                  <button 
                    type="button" 
                    onClick={handleClearFirebaseConfig}
                    className="px-4 py-2 rounded-xl border border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold text-xs transition-all cursor-pointer"
                  >
                    Desconectar Firebase
                  </button>
                )}
              </div>
            </form>

            {/* Price Tariff settings panel */}
            <div className="p-6 bg-[#121214]/90 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-indigo-400" />
                  Tarifa por kWh
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Configura el precio fijo de energía en Pesos Dominicanos (RD$) para calcular los costos consumidos en tu dashboard.
                </p>
                
                <div className="mt-6">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Precio por kWh (RD$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">RD$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={tariffRate}
                      onChange={(e) => saveTariffRate(e.target.value)}
                      className="pl-12 pr-4 py-2.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 transition-all font-bold"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowConfig(false)}
                className="w-full mt-6 py-2 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cerrar Configuración
              </button>
            </div>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Prepaid Balance */}
          <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo relative group overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sans block">Saldo Prepago Restante</span>
                <span className="text-[10px] text-zinc-500 font-semibold font-sans">Medidor: {meterStatus?.meterId}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-white font-sans tracking-tight leading-none truncate">
                {meterStatus?.balanceStr}
              </h3>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9px] text-zinc-500 font-bold font-sans">
                  ≈ RD$ {( (meterStatus?.remainingBalance || 0) * tariffRate ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button 
                  onClick={() => setShowRefillModal(true)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  <Plus className="w-3 h-3" /> Recargar
                </button>
              </div>
              {meterStatus?.fechaBalance && (
                <div className="mt-2.5 pt-2.5 border-t border-zinc-900/60 text-[9px] text-zinc-500 font-medium font-sans flex justify-between">
                  <span>Timestamp Lectura:</span>
                  <span className="text-zinc-400 font-semibold">{meterStatus.fechaBalance}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Energy Consumed Today */}
          <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-emerald relative group overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sans block">Consumo de Hoy</span>
                <span className="text-[10px] text-zinc-500 font-semibold font-sans">Tarifa: RD$ {tariffRate.toFixed(2)}/kWh</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-white font-sans tracking-tight leading-none">
                {todayKwh.toFixed(2)} kWh
              </h3>
              <div className="mt-2 text-[10px] text-zinc-500 font-bold font-sans flex justify-between">
                <span>Costo estimado hoy:</span>
                <span className="text-emerald-400">RD$ {todayCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Details of Suspension / Date Limit */}
          <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-purple relative group overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sans block">Suspensión al Llegar A</span>
                <span className="text-[10px] text-zinc-500 font-semibold font-sans">Límite Técnico</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Clock className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-white font-sans tracking-tight leading-none truncate">
                {meterStatus?.suspensionStr}
              </h3>
              <div className="mt-2.5 text-[10px] text-zinc-500 font-bold font-sans flex justify-between">
                <span>Fecha aprox. corte:</span>
                <span className="text-violet-400 font-semibold">{meterStatus?.corteDate}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Accumulated Reading */}
          <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo relative group overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-sans block">Lectura del Medidor</span>
                <span className="text-[10px] text-zinc-500 font-semibold font-sans">Acumulado Histórico</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-white font-sans tracking-tight leading-none">
                {meterStatus?.totalAccumulatedKwh ? `${meterStatus.totalAccumulatedKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh` : '0.0 kWh'}
              </h3>
              <div className="mt-2 text-[10px] text-zinc-500 font-bold font-sans flex justify-between">
                <span>Monto gastado (30d):</span>
                <span className="text-zinc-300">RD$ {readings.reduce((acc, r) => acc + r.cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {meterStatus?.fechaBalance && (
                <div className="mt-2.5 pt-2.5 border-t border-zinc-900/60 text-[9px] text-zinc-500 font-medium font-sans flex justify-between">
                  <span>Timestamp Lectura:</span>
                  <span className="text-zinc-400 font-semibold">{meterStatus.fechaBalance}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts and Sidebar Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Custom SVG Chart Area */}
          <div className="lg:col-span-2 p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo flex flex-col justify-between h-[380px]">
            <div className="flex items-center justify-between border-b border-[#222226] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-sans">Comparativa de Consumo</h3>
                <p className="text-xs text-zinc-500 font-sans mt-0.5">{chartData.title}</p>
              </div>

              {/* Selector Tabs */}
              <div className="flex items-center gap-1 bg-[#18181b] border border-[#222226] p-1 rounded-xl">
                <button
                  onClick={() => setActiveChartTab('daily')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer
                    ${activeChartTab === 'daily' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'}`}
                >
                  Día
                </button>
                <button
                  onClick={() => setActiveChartTab('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer
                    ${activeChartTab === 'monthly' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'}`}
                >
                  Mes
                </button>
                <button
                  onClick={() => setActiveChartTab('yearly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer
                    ${activeChartTab === 'yearly' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'}`}
                >
                  Año
                </button>
              </div>
            </div>

            {/* Custom SVG Chart Graph */}
            <div className="flex-1 mt-6 relative">
              {readings.length > 0 ? (
                <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                  {/* Horizontal gridlines */}
                  {[0, 1, 2, 3].map((val, idx) => {
                    const y = 20 + idx * 55;
                    const labelValue = Math.round(chartData.max - (idx / 3) * chartData.max);
                    return (
                      <g key={idx}>
                        <line x1="40" y1={y} x2="570" y2={y} stroke="#222226" strokeWidth="1" strokeDasharray="3 3" />
                        <text x="30" y={y + 4} fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="end">{labelValue}</text>
                      </g>
                    );
                  })}

                  {/* Bars or Lines depending on Active tab */}
                  {activeChartTab === 'monthly' || activeChartTab === 'yearly' ? (
                    chartData.values.map((val, idx) => {
                      const colWidth = (530 / chartData.values.length);
                      const pad = colWidth * 0.25;
                      const x = 40 + idx * colWidth + pad;
                      const barHeight = (val / chartData.max) * 165;
                      const y = 185 - barHeight;

                      return (
                        <g key={idx} className="group cursor-pointer">
                          <rect
                            x={x}
                            y={y}
                            width={colWidth - pad * 2}
                            height={Math.max(barHeight, 2)}
                            rx="4"
                            fill={activeChartTab === 'monthly' ? 'url(#barEmeraldGlow)' : 'url(#barIndigoGlow)'}
                            className="transition-all duration-300 hover:brightness-125"
                          />
                          <text
                            x={x + (colWidth - pad * 2) / 2}
                            y={y - 8}
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="black"
                            textAnchor="middle"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })
                  ) : (
                    (() => {
                      const stepX = chartData.values.length > 1 ? 530 / (chartData.values.length - 1) : 530;
                      const points = chartData.values.map((val, idx) => ({
                        x: 40 + idx * stepX,
                        y: 185 - (val / chartData.max) * 165
                      }));

                      const pathLine = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const pathArea = `${pathLine} L ${points[points.length - 1].x} 185 L ${points[0].x} 185 Z`;

                      return (
                        <g>
                          <defs>
                            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={pathArea} fill="url(#areaGlow)" />
                          <path d={pathLine} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, idx) => (
                            <g key={idx} className="group cursor-pointer">
                              <circle cx={p.x} cy={p.y} r="5" fill="#09090b" stroke="#6366f1" strokeWidth="2" className="transition-all hover:r-7 hover:stroke-white" />
                              <text
                                x={p.x}
                                y={p.y - 10}
                                fill="#ffffff"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              >
                                {chartData.values[idx]}
                              </text>
                            </g>
                          ))}
                        </g>
                      );
                    })()
                  )}

                  {/* Bottom X Labels */}
                  {chartData.labels.map((lbl, idx) => {
                    const isBarChart = activeChartTab === 'monthly' || activeChartTab === 'yearly';
                    let x = 0;
                    if (isBarChart) {
                      const stepX = 530 / chartData.labels.length;
                      x = 40 + idx * stepX + stepX / 2;
                    } else {
                      const stepX = chartData.labels.length > 1 ? 530 / (chartData.labels.length - 1) : 530;
                      x = 40 + idx * stepX;
                    }
                    return (
                      <text key={idx} x={x} y="205" fill="#71717a" fontSize="9" fontWeight="bold" textAnchor="middle">
                        {lbl}
                      </text>
                    );
                  })}

                  <defs>
                    <linearGradient id="barIndigoGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="barEmeraldGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <TrendingUp className="w-10 h-10 text-zinc-700 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-zinc-500 font-sans">
                    Esperando lecturas de base de datos para graficar consumos...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recharge History Panel */}
          <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-purple flex flex-col justify-between h-[380px]">
            <div>
              <div className="flex items-center justify-between border-b border-[#222226] pb-3">
                <h3 className="text-md font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-violet-400" /> Historial de Cargas
                </h3>
                <span className="text-[10px] text-zinc-500 font-bold">Total: {refills.length}</span>
              </div>

              {/* Scrollable refill list */}
              <div className="mt-4 space-y-3 h-[250px] overflow-y-auto pr-1">
                {refills.length > 0 ? (
                  refills.map((ref, idx) => (
                    <div key={ref.id || idx} className="p-3 bg-[#18181b]/40 border border-[#222226]/50 rounded-xl hover:border-zinc-800 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold">
                          RD$
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">RD$ {ref.amount.toLocaleString()}</p>
                          <span className="text-[9px] text-zinc-500 font-medium">
                            {new Date(ref.timestamp).toLocaleDateString()} {new Date(ref.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5 uppercase tracking-wide">
                          +{ref.kwhEquivalent.toFixed(1)} kWh <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <FileText className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-xs font-semibold text-zinc-500">No hay recargas registradas.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Database Logs table */}
        <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-emerald">
          <div className="border-b border-[#222226] pb-4 mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-white font-sans">Registro de Mediciones</h3>
              <p className="text-xs text-zinc-500 font-sans mt-0.5">Histórico diario de consumo eléctrico y validación en la nube (datos reales)</p>
            </div>
            
            <span className="text-xs font-bold text-zinc-500">
              Mostrando {readings.length} lecturas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222226]/50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider font-sans">
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Consumo de hoy (kWh)</th>
                  <th className="pb-3">Costo de hoy (RD$)</th>
                  <th className="pb-3">Lectura del Medidor</th>
                  <th className="pb-3">Balance Prepago (kWh)</th>
                  <th className="pb-3 text-right">Estatus API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226]/20">
                {readings.length > 0 ? (
                  readings.map((r, idx) => (
                    <tr key={r.date || idx} className="hover:bg-[#18181b]/30 group transition-colors duration-150">
                      <td className="py-3 text-xs font-bold text-white font-sans flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div className="flex flex-col">
                          <span>{r.date}</span>
                          {r.fechaBalance && (
                            <span className="text-[9px] text-zinc-500 font-normal">
                              Lectura: {r.fechaBalance}
                            </span>
                          )}
                        </div>
                        {idx === 0 && (
                          <span className="text-[8px] font-bold uppercase px-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse self-start mt-0.5">
                            Hoy
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-xs font-bold text-zinc-300 font-sans">
                        {r.kwhConsumed.toFixed(2)} kWh
                      </td>
                      <td className="py-3 text-xs font-bold text-emerald-400 font-sans">
                        RD$ {r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-xs font-bold text-zinc-400 font-mono">
                        {r.lecturaKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
                      </td>
                      <td className="py-3 text-xs font-bold text-zinc-400 font-mono">
                        {r.balanceKwh.toFixed(1)} kWh
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border
                          ${r.verified 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/15'}`}
                        >
                          {r.verified ? <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> : <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />}
                          {r.verified ? 'Verificado' : 'Sin Validar'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-xs font-semibold text-zinc-600 font-sans">
                      No se encontraron registros de mediciones reales en la base de datos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Versions and Updates Section */}
        <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo space-y-6">
          <div className="border-b border-[#222226] pb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-white font-sans flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Historial de Versiones y Mejoras
              </h3>
              <p className="text-xs text-zinc-500 font-sans mt-0.5">Control de versiones de la aplicación y registro de fallos corregidos</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              Versión Actual: v1.3.0
            </span>
          </div>

          <div className="space-y-6">
            {/* Version 1.3.0 */}
            <div className="relative pl-6 border-l border-indigo-500/30 space-y-2">
              <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-white">Versión 1.3.0 - Optimización de Rendimiento y UX</h4>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Reciente</span>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                <li><span className="font-semibold text-zinc-300">Carga Optimista Instantánea</span>: El dashboard se inicializa en milisegundos con los datos históricos de Firestore/LocalStorage antes de consultar a CEPM.</li>
                <li><span className="font-semibold text-zinc-300">Sincronización Asíncrona en Segundo Plano</span>: Eliminado el splash screen molesto de bloqueo al actualizar. Ahora se actualiza en segundo plano mostrando un spinner discreto inline en el banner.</li>
                <li><span className="font-semibold text-zinc-300">Limpieza Síncrona de Transición</span>: Al cambiar de medidor, la interfaz limpia síncronamente todas las métricas, saldo y gráficos viejos a un estado "Cargando..." antes de hidratar el nuevo medidor.</li>
                <li><span className="font-semibold text-zinc-300">Prevención de Fallback a Mockups</span>: Si la API de la distribuidora falla, el sistema muestra una advertencia sin corromper el historial real con datos simulados.</li>
              </ul>
            </div>

            {/* Version 1.2.0 */}
            <div className="relative pl-6 border-l border-zinc-800 space-y-2">
              <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-700 ring-4 ring-zinc-700/20" />
              <h4 className="text-sm font-bold text-white">Versión 1.2.0 - Aislamiento Multimedidor y Firebase</h4>
              <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                <li><span className="font-semibold text-zinc-300">Soporte Multimedidor Completo</span>: Estructuración de subcolecciones aisladas en Firestore para dar soporte a múltiples medidores sin colisión de datos.</li>
                <li><span className="font-semibold text-zinc-300">Tarifa Personalizada por Medidor</span>: Cada medidor cuenta con su propia tarifa configurable en Firestore para ajustarse a diferentes zonas del país.</li>
                <li><span className="font-semibold text-zinc-300">Timestamps Reales de Lectura</span>: Integración de la hora real de última lectura de la distribuidora (`fechaBalance`) en tarjetas KPI y tabla.</li>
              </ul>
            </div>

            {/* Version 1.1.0 */}
            <div className="relative pl-6 border-l border-zinc-800 space-y-2">
              <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-700 ring-4 ring-zinc-700/20" />
              <h4 className="text-sm font-bold text-white">Versión 1.1.0 - Consumo Diferencial y Tarifa Sugerida</h4>
              <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                <li><span className="font-semibold text-zinc-300">Cálculo Diferencial de Consumo</span>: Consumo de hoy calculado como diferencia entre lecturas históricas, evitando registros duplicados.</li>
                <li><span className="font-semibold text-zinc-300">Sugerencia de Tarifas de Recarga</span>: Detección automática del incremento de saldo para sugerir la tarifa real implícita en base a la recarga de pesos.</li>
                <li><span className="font-semibold text-zinc-300">Comparativas Temporales de Gráficas</span>: Vistas de gráficos dinámicos Día, Mes y Año con etiquetas X formateadas.</li>
              </ul>
            </div>

            {/* Version 1.0.0 */}
            <div className="relative pl-6 space-y-2">
              <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-700 ring-4 ring-zinc-700/20" />
              <h4 className="text-sm font-bold text-white">Versión 1.0.0 - Lanzamiento Inicial</h4>
              <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                <li><span className="font-semibold text-zinc-300">Scraping de Balance</span>: Conectividad y parseo de HTML en tiempo real con la oficina virtual de CEPM.</li>
                <li><span className="font-semibold text-zinc-300">UI Dashboard</span>: Diseño de interfaz futurista oscuro con glassmorphism, tarjetas de saldo prepago y gráficos interactivos.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Modal for top-up recharge */}
      {showRefillModal && (
        <div className="fixed inset-0 z-50 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                Nueva Recarga Prepago
              </h3>
              <button 
                onClick={() => setShowRefillModal(false)}
                className="text-zinc-500 hover:text-white cursor-pointer transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">
                  Monto de Recarga (RD$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">RD$</span>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Monto a recargar, ej. 1000"
                    value={refillAmount}
                    onChange={(e) => setRefillAmount(e.target.value)}
                    className="pl-12 pr-4 py-3 w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 text-zinc-200 text-sm rounded-xl focus:outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">
                  kWh Recibidos (Opcional, para estimar tarifa)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="kWh acreditados, ej. 60"
                  value={kwhReceivedInput}
                  onChange={(e) => setKwhReceivedInput(e.target.value)}
                  className="px-3 py-3 w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 text-zinc-200 text-sm rounded-xl focus:outline-none transition-all font-semibold"
                />
                {refillAmount && kwhReceivedInput && !isNaN(parseFloat(refillAmount)) && !isNaN(parseFloat(kwhReceivedInput)) && (
                  <span className="text-[10px] text-violet-400 font-bold mt-1.5 block">
                    Tarifa resultante estimada: RD$ {(parseFloat(refillAmount) / parseFloat(kwhReceivedInput)).toFixed(2)} / kWh
                  </span>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={refillLoading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/15"
                >
                  {refillLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Procesando pago...
                    </>
                  ) : (
                    'Confirmar Carga'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefillModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for adding new Meter ID */}
      {showAddMeterModal && (
        <div className="fixed inset-0 z-50 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                Registrar Nuevo Medidor
              </h3>
              <button 
                onClick={() => setShowAddMeterModal(false)}
                className="text-zinc-500 hover:text-white cursor-pointer transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewMeter} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">
                  Número de Medidor o Suministro
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. D037002909"
                  value={newMeterIdInput}
                  onChange={(e) => setNewMeterIdInput(e.target.value)}
                  className="px-3 py-3 w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 text-zinc-200 text-sm rounded-xl focus:outline-none transition-all font-semibold"
                />
                <p className="text-[10px] text-zinc-500 mt-2 font-medium">
                  Al guardar, se realizará una comprobación automática con CEPM y se inicializará el histórico en base de datos.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-500/15"
                >
                  Registrar Medidor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMeterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="mt-12 text-center text-[10px] text-zinc-600 font-sans">
        &copy; {new Date().getFullYear()} Dashy Power System. Todos los derechos reservados.
      </footer>
    </div>
  );
}
