import useConfig from "./useConfig.ts"

// useFetch wraps the native Deno fetch api and inserts a User-Agent header
export default function useFetch(input: string | URL | Request, init?: RequestInit | undefined): Promise<Response> {
  const { UserAgent } = useConfig()
  const requestInit = init ?? {} as RequestInit
  if (UserAgent) {
    requestInit.headers = { ...requestInit.headers, "User-Agent": UserAgent }
  }
  return fetch(input, requestInit)
}
