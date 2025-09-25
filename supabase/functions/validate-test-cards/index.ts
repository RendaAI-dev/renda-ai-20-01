import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cardNumber } = await req.json()
    
    if (!cardNumber) {
      throw new Error('Número do cartão é obrigatório')
    }

    console.log(`[VALIDATE-TEST-CARDS] Validando cartão: ${cardNumber}`)

    // Cartões de teste do Asaas Sandbox
    const testCards = {
      // Cartões que são aprovados automaticamente
      '5162306219378829': {
        type: 'test',
        brand: 'MASTERCARD',
        status: 'approved',
        description: 'Cartão de teste - Aprovado automaticamente'
      },
      '5448280000000007': {
        type: 'test',
        brand: 'MASTERCARD', 
        status: 'approved',
        description: 'Cartão de teste - Aprovado automaticamente'
      },
      '4111111111111111': {
        type: 'test',
        brand: 'VISA',
        status: 'approved',
        description: 'Cartão de teste - Aprovado automaticamente'
      },
      '4000000000000002': {
        type: 'test',
        brand: 'VISA',
        status: 'declined',
        description: 'Cartão de teste - Rejeitado automaticamente'
      },
      '5555555555554444': {
        type: 'test',
        brand: 'MASTERCARD',
        status: 'approved', 
        description: 'Cartão de teste - Aprovado automaticamente'
      },
      '378282246310005': {
        type: 'test',
        brand: 'AMEX',
        status: 'approved',
        description: 'Cartão de teste - Aprovado automaticamente'
      }
    }

    // Remover espaços e caracteres especiais
    const cleanCardNumber = cardNumber.replace(/\D/g, '')
    
    let result = {
      cardNumber: cleanCardNumber,
      isValid: false,
      isTestCard: false,
      recommendation: '',
      details: null
    }

    // Verificar se é um cartão de teste conhecido
    if (testCards[cleanCardNumber]) {
      const testCard = testCards[cleanCardNumber]
      result = {
        ...result,
        isValid: true,
        isTestCard: true,
        recommendation: testCard.status === 'approved' 
          ? 'Este cartão de teste deveria ser aprovado automaticamente no sandbox'
          : 'Este cartão de teste será rejeitado automaticamente',
        details: testCard
      }
    } else {
      // Validação básica do número do cartão (algoritmo de Luhn)
      const isLuhnValid = validateLuhn(cleanCardNumber)
      
      if (isLuhnValid && cleanCardNumber.length >= 13 && cleanCardNumber.length <= 19) {
        result = {
          ...result,
          isValid: true,
          isTestCard: false,
          recommendation: 'Este parece ser um cartão real. No ambiente sandbox, use cartões de teste para evitar problemas.',
          details: {
            type: 'real',
            length: cleanCardNumber.length
          }
        }
      } else {
        result = {
          ...result,
          isValid: false,
          recommendation: 'Número de cartão inválido. Verifique se digitou corretamente.',
          details: {
            luhnValid: isLuhnValid,
            lengthValid: cleanCardNumber.length >= 13 && cleanCardNumber.length <= 19
          }
        }
      }
    }

    // Adicionar lista de cartões recomendados para teste
    result.recommendedTestCards = [
      {
        number: '5162306219378829',
        brand: 'MASTERCARD',
        description: 'Aprovado automaticamente'
      },
      {
        number: '4111111111111111', 
        brand: 'VISA',
        description: 'Aprovado automaticamente'
      },
      {
        number: '5555555555554444',
        brand: 'MASTERCARD',
        description: 'Aprovado automaticamente'
      }
    ]

    console.log('[VALIDATE-TEST-CARDS] Resultado:', result)

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[VALIDATE-TEST-CARDS] Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Algoritmo de Luhn para validar número do cartão
function validateLuhn(cardNumber: string): boolean {
  let sum = 0
  let isEven = false
  
  // Percorrer os dígitos da direita para a esquerda
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i))
    
    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    
    sum += digit
    isEven = !isEven
  }
  
  return sum % 10 === 0
}