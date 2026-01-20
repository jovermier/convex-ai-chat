import { query } from "./_generated/server"

export const checkEnv = query({
  args: {},
  handler: async _ctx => {
    const jwtKey = process.env.JWT_PRIVATE_KEY
    return {
      hasJwtKey: !!jwtKey,
      jwtKeyLength: jwtKey?.length,
      jwtKeyStart: jwtKey?.substring(0, 50),
      jwtKeyEnd: jwtKey?.substring(jwtKey.length - 50),
      issuer: process.env.JWT_ISSUER,
    }
  },
})
