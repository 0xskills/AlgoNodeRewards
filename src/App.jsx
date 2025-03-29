
import { useState, useEffect } from 'react'
import './App.css'
import axios from 'axios'

import 'bootstrap/dist/css/bootstrap.min.css';

import DataTable from 'react-data-table-component';

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

import AlgoSdk from 'algosdk'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);



function msToDHMS(ms) {
  // 1- Convert to seconds:
  let seconds = ms / 1000;
  // 2 - Extract days
  const days = parseInt(seconds / 86400); // 86,400 seconds in 1 day
  seconds = seconds % 86400
  // 3- Extract hours:
  const hours = parseInt(seconds / 3600); // 3,600 seconds in 1 hour
  seconds = seconds % 3600; // seconds remaining after extracting hours
  // 4- Extract minutes:
  const minutes = parseInt(seconds / 60); // 60 seconds in 1 minute
  // 5- Keep only seconds not extracted to minutes:
  seconds = seconds % 60;
  return (days + "d " + ('0' + hours).slice(-2) + ":" + ('0' + minutes).slice(-2) + ":" + ('0' + seconds).slice(-2));
}


function processTxs(txs, txStakingStart, stakedAmount) {

  let msInaYear = 1000 * 60 * 60 * 24 * 365

  let data = []
  let cumEarnings = 0
  txs.reverse().forEach((tx) => {

    let tsTxDt = Date.parse(tx.roundTime)
    let elapsed = tsTxDt - Date.parse(txStakingStart)

    let amount = Number(tx.amount) / 10 ** 6
    let earnings = data.reduce((x, y) => x + Number.parseFloat(Number(y.amount) * 1), 0)
    let cumEarnings = (earnings == 0 ? amount : earnings + amount).toFixed(2) * 1

    let forecastYear = msInaYear * cumEarnings / elapsed
    let apr = (forecastYear / stakedAmount * 100).toFixed(2) * 1

    data.push({ roundTime: tx.roundTime, round: tx.round, amount: amount, elapsedMs: elapsed, elapsed: msToDHMS(elapsed), earnings: cumEarnings, apr: apr })

  })

  // Unique dates
  let blocksPerDay = []
  data.forEach(function (i) {
    let dt = i.roundTime.substring(5, 10);
    blocksPerDay[dt] = (blocksPerDay[dt] || 0) + 1;
  });
  let chartLabels = Object.keys(blocksPerDay)
  let chartValues = Object.values(blocksPerDay)

  let first = new Date(data.length == 0 ? 0 : data[0].roundTime)
  let last = new Date(data.length == 0 ? 0 : data[data.length - 1].roundTime)
  let days = ((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)).toFixed(2)
  let avgBlocksDay = (data.length / days).toFixed(2)
  //console.table([{ 'Total blocks': data.length, 'Total days': days * 1, 'Avg Blocks/Day': avgBlocksDay * 1 }])

  return {
    stats: {
      elapsedDays: days * 1,
      totalBlocks: data.length,
      earnings: cumEarnings,
      avgBlocksDay: avgBlocksDay * 1,
      firstRound: first,
      lastRound: last,
    },
    txs: data,
    chart: {
      labels: chartLabels,
      values: chartValues
    }
  }
}


function getAlgoPrice() {
  return fetch('https://api.binance.com/api/v3/ticker/price?symbol=ALGOUSDT')
    .then((response) => response.json())
    .then((responseJson) => {
      return responseJson.price;
    })
    .catch((error) => {
      console.error(error);
    });
}

function App() {


  const [state, setState] = useState({
    price: 0,
    address: '',
    staked: '',
    stats: {},
    txs: [],
    chart: {
      labels: [],
      values: []
    }
  });


  const [option, setOption] = useState({ start: '2025-01-23T00:00:00.000Z', end: '2025-04-01T00:00:00.000Z' });

  const options = [
    {
      label: '2025 Q1',
      value: { start: '2025-01-23T00:00:00.000Z', end: '2025-04-01T00:00:00.000Z' },
    }, 
    {
      label: '2025 Q2',
      value: { start: '2025-04-01T00:00:00.000Z', end: '2025-07-01T00:00:00.000Z' },
    },/*
    {
      label: '2025 Q3',
      value: { start: '2025-07-01T00:00:00.000Z', end: '2025-10-01T00:00:00.000Z' },
    },
    {
      label: '2025 Q4',
      value: { start: '2025-10-01T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z' },
    },
    {
      label: '2026 Q1',
      value: { start: '2026-01-23T00:00:00.000Z', end: '2026-04-01T00:00:00.000Z' },
    },
    {
      label: '2026 Q2',
      value: { start: '2026-04-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
    },
    {
      label: '2026 Q3',
      value: { start: '2026-07-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' },
    },
    {
      label: '2026 Q4',
      value: { start: '2026-10-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
    },
    {
      label: 'All',
      value: { start: '2025-01-23T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
    }*/
  ];
  const selectHandler = (e) => {
    //console.log(e.target.value);
    switch (e.target.value) {
      case 'All':
        setOption(options[0].value);
        break;
      case '2025 Q1':
        setOption(options[0].value);
        break;
      case '2025 Q2':
        setOption(options[1].value);
        break;
      case '2025 Q3':
        setOption(options[2].value);
        break;
      case '2025 Q4':
        setOption(options[3].value);
        break;
    }
  }


  function fetchData() {

    let address = state.address

    console.log(`${address} valid:${AlgoSdk.isValidAddress(address)}`)
    if (!AlgoSdk.isValidAddress(address)) { return; }

    setState((prev) => ({ ...prev, stats: [], txs: [] }));

    const indexerClient = new AlgoSdk.Indexer("", "https://mainnet-idx.4160.nodely.dev", "");

    indexerClient.lookupAccountTransactions(address).afterTime(option.start).beforeTime(option.end).do().then((accountTxns) => {
      let rewardTxs = accountTxns.transactions.filter((tx) => tx.sender == 'Y76M3MSY6DKBRHBL7C3NNDXGS5IIMQVQVUAB6MP4XEMMGVF2QWNPL226CA')
      let txs = rewardTxs.map((tx) => {
        //console.log(tx['roundTime'])
        return {
          'roundTime': new Date(tx['roundTime'] * 1000).toISOString().slice(0, 19).replace('T', ' '),
          'round': Number(tx['confirmedRound']),
          amount: tx['paymentTransaction']['amount']
        }
      })


      let data = processTxs(txs, option.start, state.staked)
  
      //console.table([data.stats])
      //console.table(data.txs.reverse(), ['amount', 'elapsed', 'earnings', 'apr'])

      setState((prev) => ({ ...prev, stats: data.stats, txs: data.txs.reverse(), chart: data.chart }));

    })


  }

  const handleFetchData = (e) => {
    e.preventDefault(); // prevent the default action    

    setState((prev) => ({ ...prev, stats: [], txs: [] }));
    setTimeout(() => {
      fetchData()
    }, 1000);
  };

  useEffect(() => {
    //fetchData();
    getAlgoPrice().then(res=>{
      setState((prev) => ({ ...prev, price: res }))
    })
    
  }, [])


  const optionsChart = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Blocks Per Day",
      },
    },
  };

  const labels = state.chart.labels;

  const data = {
    labels,
    datasets: [
      {
        label: "Blocks",
        backgroundColor: "lightblue",
        borderColor: "royalblue",
        data: state.chart.values,
      },
    ],
  };

  return (
    <>
      <p>WARNING: No data is saved on this page. To fetch transactions, query is perfomed to Nodely.io free api.</p>
      <h1>Algorand Staking Rewards</h1>

      <div className="container" style={{ minHeight: 150, marginBottom: 40 }}>
        <form onSubmit={handleFetchData}>
          <input placeholder="Staking address" name="saddr" onChange={(e) => setState((prev) => ({ ...prev, address: e.target.value }))} value={state.address} className="form-control" ></input>
          <input placeholder="Optional: Staking amount - Required for APR calculation" name="stakingAmt" onChange={(e) => setState((prev) => ({ ...prev, staked: e.target.value }))} value={state.staked} className="form-control" style={{ "minWidth": "50px" }}></input>

          <select className="form-select" onChange={(e) => selectHandler(e)}>
            {options.map((option) => (
              <option key={option.label} >{option.label}</option>
            ))}
          </select >
          <button type='submit' style={{ "margin": '10px', "fontWeight": "bold" }}>Fetch Rewards</button>
        </form>
      </div>

      {state.txs.length > 0 &&
        <div className="container" style={{ maxHeight: '300px', marginBottom: 40 }}>
          <Bar options={optionsChart} data={data} style={{ display: 'unset' }} />
        </div>
      }

      {state.txs.length > 0 &&
        <div className="container" style={{ minHeight: 150, marginBottom: 40 }}>
          <div className="row">
            <div className="col" >
              {state.txs.length > 0 &&
                <div style={{ width: 100, height: 100, margin: 'auto', marginBottom: 40 }}>
                  Total Blocks
                  <CircularProgressbar value={100}
                    text={`${state.stats.totalBlocks}`}
                    styles={buildStyles({
                      pathColor: `#cccccc`
                    })} />
                </div>
              }
            </div>
            <div className="col" >
              {state.txs.length > 0 &&
                <div style={{ width: 100, height: 100, margin: 'auto', marginBottom: 40 }}>
                  Avg.Blocks/Day
                  <CircularProgressbar value={100} text={`${state.stats.avgBlocksDay}`} styles={buildStyles({
                    pathColor: `#cccccc`
                  })} />
                </div>
              }
            </div>
            <div className="col" >
              {state.txs.length > 0 &&
                <div style={{ width: 100, height: 100, margin: 'auto', marginBottom: 40 }}>
                  Earnings
                  <CircularProgressbar value={100} text={`${state.txs[0].earnings}`} styles={buildStyles({
                    pathColor: `#cccccc`
                  })} />
                </div>
              }
            </div>
            <div className="col" >
              {state.txs.length > 0 &&
                <div style={{ width: 100, height: 100, margin: 'auto', marginBottom: 40 }}>
                  Earnings USD
                  <CircularProgressbar value={100} text={`$${(state.txs[0].earnings * state.price).toFixed(0)}`} styles={buildStyles({
                    pathColor: `#cccccc`
                  })} />
                </div>
              }
            </div>
            <div className="col" >

              {state.txs.length > 0 &&
                <div style={{ width: 100, height: 100, margin: 'auto', marginBottom: 40 }}>
                  APR
                  <CircularProgressbar value={100} text={`${state.txs[0].apr}`} styles={buildStyles({
                    pathColor: `#cccccc`
                  })} />
                </div>
              }
            </div>
          </div>
        </div>
      }



      <div className="container">
        <DataTable
          columns={[
            {
              name: 'RoundTime',
              selector: row => row.roundTime,
              grow: 2
            }, {
              name: 'Round',
              selector: row => row.round,
            },
            {
              name: 'Elapsed',
              selector: row => row.elapsed,
              grow: 2
            },
            {
              name: 'Amount',
              selector: row => row.amount,
            },
            {
              name: 'Earnings',
              selector: row => row.earnings,
            },
            {
              name: 'APR',
              selector: row => row.apr,
            },]}
          data={state.txs}
          pagination
        />
      </div>
      <p className="read-the-docs">
        Powered by Nodely.io
      </p>
    </>
  )
}

export default App
