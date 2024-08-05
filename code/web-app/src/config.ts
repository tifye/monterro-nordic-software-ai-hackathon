type AppConfig = {
  api_base_url: string
  oauth_agent_base_url: string
  api_base_gql_url: string
  openai_key: string
}

function loadConfig(): AppConfig {
  const api_base_url = process.env.REACT_APP_API_BASE_URL
  const oauth_agent_base_url = process.env.REACT_APP_OAUTH_AGENT_BASE_URL
  const api_base_gql_url = process.env.REACT_APP_API_GQL_BASE_URL
  const openai_key = process.env.REACT_APP_OPENAI_KEY

  if (!api_base_url) throw new Error('REACT_APP_API_BASE_URL has not been set.')
  if (!oauth_agent_base_url)
    throw new Error('REACT_APP_OAUTH_BASE_URL has not been set')
  if (!api_base_gql_url) throw new Error('missing gql url')
  if (!openai_key) throw new Error('missing openai key')

  return {
    api_base_url,
    oauth_agent_base_url,
    api_base_gql_url,
    openai_key,
  }
}

const config = loadConfig()

export default config
