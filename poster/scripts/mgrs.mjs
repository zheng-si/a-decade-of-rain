// lat/lon (WGS84) -> MGRS 100km-square + easting/northing digits, HERBS style
// e.g. XC845638  (square XC, 845 638 = 100m precision)
const a=6378137, f=1/298.257223563, e2=f*(2-f), k0=0.9996
export function mgrs(lon, lat, digits=3) {
  const zone=Math.floor((lon+180)/6)+1
  const lon0=(zone-1)*6-180+3
  const rad=Math.PI/180
  const phi=lat*rad, lam=(lon-lon0)*rad
  const N=a/Math.sqrt(1-e2*Math.sin(phi)**2)
  const Tt=Math.tan(phi)**2
  const C=e2/(1-e2)*Math.cos(phi)**2
  const A=Math.cos(phi)*lam
  const e4=e2*e2, e6=e4*e2
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*phi
    -(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*phi)
    +(15*e4/256+45*e6/1024)*Math.sin(4*phi)
    -(35*e6/3072)*Math.sin(6*phi))
  let E=k0*N*(A+(1-Tt+C)*A**3/6+(5-18*Tt+Tt*Tt+72*C-58*e2/(1-e2))*A**5/120)+500000
  let Nn=k0*(M+N*Math.tan(phi)*(A*A/2+(5-Tt+9*C+4*C*C)*A**4/24+(61-58*Tt+Tt*Tt+600*C-330*e2/(1-e2))*A**6/720))
  if(lat<0) Nn+=10000000
  // 100km square letters
  const colSets=['ABCDEFGH','JKLMNPQR','STUVWXYZ']
  const colLetters=colSets[(zone-1)%3]
  const colIdx=Math.floor(E/100000)-1
  const colL=colLetters[colIdx]
  const rowSeq='ABCDEFGHJKLMNPQRSTUV'
  let rowIdx=Math.floor(Nn/100000)%20
  if(zone%2===0) rowIdx=(rowIdx+5)%20
  const rowL=rowSeq[rowIdx]
  const ed=Math.floor((E%100000)/Math.pow(10,5-digits)).toString().padStart(digits,'0')
  const nd=Math.floor((Nn%100000)/Math.pow(10,5-digits)).toString().padStart(digits,'0')
  return `${colL}${rowL}${ed}${nd}`
}
