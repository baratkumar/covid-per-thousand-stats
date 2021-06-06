import axios from 'axios'
import cheerio from 'cheerio'
import fs from 'fs'

const fetchDataFromURL = async(url) => {
  const { data } = await axios.get(url)
  return cheerio.load(data).html()
}

const fetchPopulationByEachCountry = async() => {
  const result = {}
  const url = 'https://www.worldometers.info/world-population/population-by-country/'
  const htmlResponse = await fetchDataFromURL(url)
  const $ = cheerio.load(htmlResponse)
  let name, population
  $('#example2 > tbody')
    .find('tr > td')
    .each((index, element) => {
      const modValue = index % 12
      name = modValue === 1 ? $(element).text() : name
      population = modValue === 2 ? $(element).text(): population
      if (modValue && modValue > 2 && name && population){
        name = name.toUpperCase()
        population = parseInt(population.split(',').join(''))
        result[name] = { population }
        name = undefined
        population = undefined
      }
    })
  return result
}

const fetchCovidDataByEachCountry = async() => {
  const result = {}
  const url = 'https://en.wikipedia.org/w/index.php?title=Template:COVID-19_pandemic_data#covid-19-pandemic-data'
  const htmlResponse = await fetchDataFromURL(url)
  const $ = cheerio.load(htmlResponse)
  const rowCount = $('#thetable tr').length
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    let data = $(`#thetable tr:nth-child(${rowIndex})`).text()
    data = data.trim().replace(/\n/g,'_').split('_')
    data = data.filter(item => item !== '')
    const countryName = data && data[0] ?
      data[0].split('[')[0].toUpperCase() : undefined
    if (countryName 
      && countryName !== 'LOCATION') {
      result[countryName] = { 
        total_covid_cases:  data[1] && parseInt(data[1].split(',').join('')), 
        total_covid_deaths: data[2] && parseInt(data[2].split(',').join('')) }
    }
  }
  return result
}

const fetchDeathsPerThousandinEachCountry = async() => {
  const result = {}
  const url = 'https://photius.com/rankings/2019/population/death_rate_2019_1.html'
  const htmlResponse = await fetchDataFromURL(url)
  const $ = cheerio.load(htmlResponse)
  let currentIndex, nextIndex, name, deaths_per_thousand
  $('.table > tbody')
    .find('tr > td')
    .each((index, element) => {
      if (index > 13) {
        if (currentIndex === undefined) {
          currentIndex = index
          nextIndex = currentIndex + 6
          name = $(element).text().toUpperCase()
        }
        if (index === currentIndex + 1) {
          deaths_per_thousand = parseFloat($(element).text().split('deaths')[0])
          result[name] = { deaths_per_thousand }
        }  
        if (index === nextIndex - 1) {
          currentIndex = undefined
          nextIndex = undefined
        }
      }
    })
  return result
}

const combineDataBasedOnCountry = async() => {
  const result = {}
  let avg_covid_cases_per_thousand = 0
  let avg_deaths_cases_per_thousand = 0
  let avg_deaths = 0
  let numForCalculation = 0
  let total_population = 0
  const [population, covidData, deaths] = await Promise.all([
    fetchPopulationByEachCountry(),
    fetchCovidDataByEachCountry(),
    fetchDeathsPerThousandinEachCountry()
  ])
  for (const eachCountry in population) {
    result[eachCountry] = {
      ...population[eachCountry],
      ...covidData[eachCountry],
      ...deaths[eachCountry]
    }
    total_population += result[eachCountry].population
    const populationByThousand = result[eachCountry].population / 1000
    const total_covid_cases_per_thousand = 
      parseFloat((result[eachCountry].total_covid_cases / populationByThousand).toFixed(4))
    const total_covid_deaths_per_thousand = 
      parseFloat((result[eachCountry].total_covid_deaths / populationByThousand).toFixed(4))
    if ( !isNaN(total_covid_cases_per_thousand)
      && !isNaN(total_covid_deaths_per_thousand)) {
        avg_covid_cases_per_thousand += total_covid_cases_per_thousand
        avg_deaths_cases_per_thousand += total_covid_deaths_per_thousand
        avg_deaths += result[eachCountry].deaths_per_thousand
        numForCalculation++
        result[eachCountry] = {
          ...result[eachCountry],
          total_covid_cases_per_thousand,
          total_covid_deaths_per_thousand
        }
      }
  }
  const metrics = {
    total_population,
    average_covid_cases_per_thousand: 
      parseFloat((avg_covid_cases_per_thousand / numForCalculation).toFixed(4)),
    average_covid_deaths_per_thousand: 
      parseFloat((avg_deaths_cases_per_thousand / numForCalculation).toFixed(4)),
    overall_deaths_per_thousand: 7.525
  }
  result['METRICS'] = metrics
  fs.writeFileSync('result.json',JSON.stringify(result))
  return result
}

const result = await combineDataBasedOnCountry()
console.log(result)