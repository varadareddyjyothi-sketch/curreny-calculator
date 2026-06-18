const API_BASE = 'https://open.er-api.com/v6';

const currencyCountryMap = {
  USD: 'US', EUR: 'EU', GBP: 'GB', INR: 'IN', JPY: 'JP', CNY: 'CN', AUD: 'AU',
  CAD: 'CA', CHF: 'CH', SGD: 'SG', AED: 'AE', SAR: 'SA', NZD: 'NZ', RUB: 'RU',
  BRL: 'BR', ZAR: 'ZA', MXN: 'MX', SEK: 'SE', NOK: 'NO', DKK: 'DK', PLN: 'PL'
};

const popularPairs = [
  ['USD', 'INR'],
  ['EUR', 'USD'],
  ['GBP', 'EUR'],
  ['JPY', 'USD'],
  ['AUD', 'USD'],
  ['CAD', 'USD']
];

const amountInput = document.getElementById('amount');
const fromCurrency = document.getElementById('fromCurrency');
const toCurrency = document.getElementById('toCurrency');
const fromSearch = document.getElementById('fromSearch');
const toSearch = document.getElementById('toSearch');
const resultAmount = document.getElementById('resultAmount');
const exchangeRateText = document.getElementById('exchangeRateText');
const errorMessage = document.getElementById('errorMessage');
const swapBtn = document.getElementById('swapBtn');
const convertBtn = document.getElementById('convertBtn');
const popularPairsContainer = document.getElementById('popularPairs');
const recentList = document.getElementById('recentList');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.toggle-icon');
const liveBadge = document.getElementById('liveBadge');

let currencyData = {};

function getFlag(code) {
  const countryCode = currencyCountryMap[code] || code.slice(0, 2);
  const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getCurrencyName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code;
  } catch (error) {
    return code;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(value);
}

function setError(message) {
  if (errorMessage) {
    errorMessage.textContent = message || '';
  }
}

function applyTheme() {
  const preferred = localStorage.getItem('currency-theme');
  if (preferred === 'light') {
    document.documentElement.classList.add('light-theme');
    document.body.classList.add('light-theme');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('light-theme');
    document.body.classList.remove('light-theme');
    if (themeIcon) themeIcon.textContent = '🌙';
  }
}

function populateCurrencySelect(selectElement, searchInput) {
  if (!selectElement || !searchInput) return;
  const query = searchInput.value.trim().toLowerCase();
  selectElement.innerHTML = '';

  Object.entries(currencyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([code, name]) => {
      const label = `${getFlag(code)} ${code} - ${name}`;
      if (!label.toLowerCase().includes(query)) return;

      const option = document.createElement('option');
      option.value = code;
      option.textContent = label;
      selectElement.appendChild(option);
    });

  if (!selectElement.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No matches';
    selectElement.appendChild(option);
    return;
  }

  if (!Array.from(selectElement.options).some(option => option.value === selectElement.value)) {
    selectElement.value = selectElement.options[0]?.value || '';
  }
}

function populateSelects() {
  if (!fromCurrency || !toCurrency || !fromSearch || !toSearch) return;

  populateCurrencySelect(fromCurrency, fromSearch);
  populateCurrencySelect(toCurrency, toSearch);

  const setIfAvailable = (select, value) => {
    if (!select || !select.options.length) return;
    const isAvailable = Array.from(select.options).some(option => option.value === value);
    if (isAvailable) {
      select.value = value;
    } else {
      select.value = select.options[0]?.value || '';
    }
  };

  setIfAvailable(fromCurrency, 'USD');
  setIfAvailable(toCurrency, 'INR');
}

function setSelectValue(select, value) {
  if (!select || !select.options.length) return;
  const hasValue = Array.from(select.options).some(option => option.value === value);
  if (!hasValue) return;
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

async function fetchCurrencies() {
  const response = await fetch(`${API_BASE}/latest/USD`);
  if (!response.ok) throw new Error('Unable to load currencies.');
  const data = await response.json();

  if (!data.rates) {
    throw new Error('Unable to load currencies.');
  }

  return Object.keys(data.rates).reduce((acc, code) => {
    acc[code] = getCurrencyName(code);
    return acc;
  }, { USD: 'US Dollar' });
}

async function fetchConversionRate(from, to, amount) {
  const response = await fetch(`${API_BASE}/latest/${from}`);
  if (!response.ok) throw new Error('Unable to fetch exchange rate.');
  const data = await response.json();

  if (data.result !== 'success' || !data.rates || !data.rates[to]) {
    throw new Error('Selected currencies are not available.');
  }

  const rate = data.rates[to];
  const converted = amount * rate;
  return {
    rate,
    converted,
    date: data.time_last_update_utc || new Date().toISOString()
  };
}

function renderPopularPairs() {
  if (!popularPairsContainer) return;
  popularPairsContainer.innerHTML = '';

  popularPairs.forEach(([from, to]) => {
    const button = document.createElement('button');
    button.className = 'popular-pill';
    button.innerHTML = `<strong>${from} → ${to}</strong><span>${getFlag(from)} ${getFlag(to)}</span>`;
    button.addEventListener('click', () => {
      setSelectValue(fromCurrency, from);
      setSelectValue(toCurrency, to);
      if (amountInput) amountInput.focus();
      updateConversion();
    });
    popularPairsContainer.appendChild(button);
  });
}

function saveRecentConversion(entry) {
  const recent = JSON.parse(localStorage.getItem('currency-recent') || '[]');
  const filtered = recent.filter(item => !(item.from === entry.from && item.to === entry.to && item.amount === entry.amount));
  filtered.unshift(entry);
  const trimmed = filtered.slice(0, 6);
  localStorage.setItem('currency-recent', JSON.stringify(trimmed));
  renderRecentConversions();
}

function renderRecentConversions() {
  if (!recentList) return;
  const recent = JSON.parse(localStorage.getItem('currency-recent') || '[]');
  recentList.innerHTML = '';

  if (!recent.length) {
    recentList.innerHTML = '<div class="recent-item"><span>No recent conversions yet.</span></div>';
    return;
  }

  recent.forEach(item => {
    const div = document.createElement('div');
    div.className = 'recent-item';
    div.innerHTML = `
      <div>
        <strong>${formatNumber(item.amount)} ${item.from}</strong>
        <span> → ${formatNumber(item.result)} ${item.to}</span>
      </div>
      <span>${item.date}</span>
    `;
    div.addEventListener('click', () => {
      setSelectValue(fromCurrency, item.from);
      setSelectValue(toCurrency, item.to);
      if (amountInput) amountInput.value = item.amount;
      updateConversion();
    });
    recentList.appendChild(div);
  });
}

async function updateConversion() {
  if (!amountInput || !fromCurrency || !toCurrency || !resultAmount || !exchangeRateText || !liveBadge) {
    return;
  }

  const amount = parseFloat(amountInput.value);
  const from = fromCurrency.value;
  const to = toCurrency.value;

  if (!from || !to || Number.isNaN(amount) || amount < 0) {
    return;
  }

  setError('');
  liveBadge.textContent = 'Loading…';
  resultAmount.textContent = '...';

  try {
    const data = await fetchConversionRate(from, to, amount);
    resultAmount.textContent = `${formatNumber(data.converted)} ${to}`;
    exchangeRateText.textContent = `1 ${from} = ${formatNumber(data.rate)} ${to}`;

    saveRecentConversion({
      from,
      to,
      amount,
      result: data.converted,
      date: data.date
    });
  } catch (error) {
    resultAmount.textContent = '0.00';
    exchangeRateText.textContent = 'Unable to load rate';
    setError(error.message);
  } finally {
    liveBadge.textContent = 'Live';
  }
}

async function init() {
  applyTheme();

  if (fromCurrency && toCurrency && fromSearch && toSearch && amountInput && convertBtn && swapBtn) {
    try {
      currencyData = await fetchCurrencies();
      populateSelects();
      renderPopularPairs();
      renderRecentConversions();
      await updateConversion();
    } catch (error) {
      setError(error.message);
    }
  }
}

if (fromSearch && toSearch && fromCurrency && toCurrency) {
  fromSearch.addEventListener('input', () => populateCurrencySelect(fromCurrency, fromSearch));
  toSearch.addEventListener('input', () => populateCurrencySelect(toCurrency, toSearch));
  fromCurrency.addEventListener('change', updateConversion);
  toCurrency.addEventListener('change', updateConversion);
}

if (amountInput && convertBtn) {
  amountInput.addEventListener('input', updateConversion);
  convertBtn.addEventListener('click', updateConversion);
}

if (swapBtn && fromCurrency && toCurrency) {
  swapBtn.addEventListener('click', () => {
    const currentFrom = fromCurrency.value;
    const currentTo = toCurrency.value;
    setSelectValue(fromCurrency, currentTo);
    setSelectValue(toCurrency, currentFrom);
    updateConversion();
  });
}

if (themeToggle && themeIcon) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-theme');
    document.body.classList.toggle('light-theme');
    if (document.body.classList.contains('light-theme')) {
      themeIcon.textContent = '☀️';
      localStorage.setItem('currency-theme', 'light');
    } else {
      themeIcon.textContent = '🌙';
      localStorage.setItem('currency-theme', 'dark');
    }
  });
}

const contactForm = document.getElementById('contactForm');
const successMessage = document.getElementById('successMessage');
if (contactForm && successMessage) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    successMessage.textContent = 'Thanks for reaching out! We will get back to you soon.';
    contactForm.reset();
  });
}

init();
