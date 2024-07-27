import numpy as np
from scipy.special import gammainc, gamma

def dickman_rho(u):
  if u < 1:
    return 1
  else:
    def integrand(t):
      return np.exp(t * np.log(t) - t - 1) * (t ** (u - 1))
    integral, _ = quad(integrand, 1, u)
    return (1 / gamma(u)) * integral

def proportion_m_smooth(x, m):
  u = np.log(x) / np.log(m)
  rho_u = dickman_rho(u)
  return rho_u

# Example usage
x = 10**12
m = 20000000
proportion = proportion_m_smooth(x, m)
proportion

