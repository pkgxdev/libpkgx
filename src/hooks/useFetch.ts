import useConfig from "./useConfig.ts"

// useFetch wraps the native Deno fetch api and inserts a User-Agent header
export default function useFetch(input: string | URL | Request, init?: RequestInit | undefined): Promise<Response> {
  const { UserAgent } = useConfig()
  const requestInit = init ?? {} as RequestInit
  if (UserAgent) {
    requestInit.headers = { ...requestInit.headers, "User-Agent": UserAgent }
  }
  return _internals.fetch(input, requestInit)
}

// wrapped or DNT chokes on typechecking
function chew(input: string | URL | Request, init?: RequestInit | undefined): Promise<Response> {
  return fetch(input, init)
}

export const _internals = {
  fetch: chew
}
