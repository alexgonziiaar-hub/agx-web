# Aplica las correcciones de contenido C1–C8 de la última revisión a preguntas-90.json y regenera «const DIRECTOS=» en index.html.
import json, sys
from collections import Counter
P='/tmp/claude-0/-home-user/ec1a6cef-642a-5a40-a283-3eb03b91ed9b/scratchpad/clips/preguntas-90.json'
INDEX='/home/user/agx-web/index.html'
CAMPOS=['id','cat','tema','titulo','pregunta','opciones','correcta','explicacion','clave','seg']
linea=lambda d: ' '+json.dumps({k:d[k] for k in CAMPOS},ensure_ascii=False,separators=(',',':'))
q=json.load(open(P,encoding='utf-8')); assert len(q)==90
src=open(INDEX,encoding='utf-8').read()
i=src.index('const DIRECTOS=[\n')+len('const DIRECTOS=[\n'); j=src.index('\n];',i)
assert src[i:j]==',\n'.join(linea(d) for d in q), 'el bloque de la web no coincide con preguntas-90.json antes de empezar'
def c(n,idpref):
    d=q[n-1]; assert d['id'].startswith(idpref), (n,d['id']); return d
def opcion(d,idx,viejo_ini,nuevo):
    assert d['correcta']!=idx or viejo_ini is None, ('es la correcta',d['id'])
    if viejo_ini: assert d['opciones'][idx].startswith(viejo_ini), (d['id'],d['opciones'][idx])
    d['opciones'][idx]=nuevo
# C1 · clip 77
d=c(77,'P01_saber-leer-no-basta'); assert d['correcta']==2 and d['opciones'][2].startswith('La ejecución: si el precio llega')
d['opciones'][2]='La ejecución: con el precio en tu zona y el flujo a favor, disparas con el stop del plan'
d['explicacion']='Leer bien el flujo no mueve la cuenta: la lectura solo vale cuando se convierte en una orden. Alex se lo dice a un alumno: la sabes leer, pero no la sabes ejecutar. Aquí no faltaba nada: el precio llega al imbalance del análisis con el delta positivo y «cosas a favor». Ahí tomas la entrada y ya está. Pedir otra confirmación más es miedo, y perseguir el precio tarde ya no es tu entrada.'
# C2 · clip 89
d=c(89,'P03_no-vender-en-minimos-por-ego'); assert d['correcta']==0
d['pregunta']='El NQ lleva todo el día cayendo con fuerza y tú, que lo veías bajista desde el principio, no has cogido ni una venta. El precio está ya en la desviación inferior del perfil y, aun así, te pide el cuerpo vender. ¿Qué hay detrás de esas ganas?'
d['opciones']=['Método: en un día bajista se vende mientras el precio siga marcando mínimos, esté donde esté','Contexto: cuando pierde la desviación inferior, el precio suele acelerar la caída','Ego: quieres tu parte de una caída que habías visto venir, aunque ahí ya no haya entrada','Gestión: sin operaciones en todo el día, te queda todo el riesgo de la sesión por usar']
d['correcta']=2
d['explicacion']='En la desviación inferior del perfil el precio ya está muy estirado: buscar ahí una venta no tiene sentido, y si la haces es por orgullo, por no quedarte sin tu parte de la caída. Alex lo dice así: sería «solo por alimentar nuestro ego». Haber acertado la dirección no te debe una operación, y el riesgo sin usar tampoco. La clave es mantenerte fuera, sentarte y esperar a que termine la caída.'
# C3 · clips 26 y 28
d=c(26,'C04_no-todos-los-cuadraditos')
d['explicacion']='Muchos cuadraditos seguidos son muchos stops saltando; al llegar a un Call Wall suelen anunciar un rechazo si se quedan en la mecha (dentro del cuerpo, en cambio, empujan la ruptura). Pero el indicador pinta en todas partes y no todos valen: Alex solo hace caso a los que salen donde ya tenía una zona marcada. Ahí le confirman el rechazo que quiere tomar o le evitan una falsa ruptura.'
d=c(28,'C04_stops-dentro-del-cuerpo'); assert d['correcta']==0
d['explicacion']='El stop de una venta es una orden de compra. Si al traspasar el Call Wall saltan muchos stops y quedan dentro del cuerpo, esas compras alimentan la subida: son gasolina para el precio. En la mecha sería lo contrario: un barrido que se da la vuelta, el stop run del temario. Con la temporalidad alta a favor y sin agresión vendedora, Alex compra apoyado en el Call Wall traspasado y el VWAP americano.'
opcion(d,3,'Sin lectura: los stops que saltan','Sin lectura: que salten stops es consecuencia del movimiento, no una pista de lo que viene después')
# C4 · clips 21, 45 y 43
d=c(21,'C03_una-buena-zona-imbalance-de-una-hora')
d['explicacion']='Un imbalance de 1 hora que queda en mecha es una zona muy buena: la vela ha rechazado esos precios. Si además el delta era muy vendedor y no ha servido, hay big trades en las mechas y el perfil es de rango, todo apunta al mismo lado. Por eso Alex ve la compra apoyada en el VWAP americano, con el promedio en el imbalance: una segunda entrada prevista y dentro del riesgo, no añadir sin plan.'
d=c(45,'E02_gonzi-y-la-orden-que-desaparece'); assert 'dejas el promedio por encima de una orden grande' in d['pregunta']
d['pregunta']=d['pregunta'].replace('dejas el promedio por encima de una orden grande','dejas el promedio previsto por encima de una orden grande')
d=c(43,'E02_cambio-de-idea-el-gonzi'); assert d['explicacion'].count('promedia donde están los big trades de compradores')==1
d['explicacion']=d['explicacion'].replace('promedia donde están los big trades de compradores','toma el promedio previsto donde están los big trades de compradores')
# C5 · clip 70
d=c(70,'P01_consistencia-aprovecha'); assert d['correcta']==3
d['pregunta']='Tu cuenta fondeada tiene una regla de consistencia del 50 %. Hoy el NQ da un tramo amplio y limpio y, con tu gestión de siempre, te llevas 2.000 $: este día pesa ya más de la mitad de tu beneficio. ¿Qué te cuesta haberlo cogido entero?'
d['opciones']=['Dinero: lo que pasa de la mitad no cuenta como beneficio, así que ese tramo final sobraba','Tiempo: unos cuantos días más operando, aunque sean pequeños, hasta que ese día pese la mitad','Riesgo: ahora toca subir el tamaño unos días para igualar cuanto antes el peso de ese día','Nada: con un día así la regla ya está cumplida y puedes pedir el retiro sin operar más']
d['correcta']=1
d['explicacion']='Un recorrido largo no sale todos los días: si el mercado te deja sacarle 1.000 o 2.000 $, se cogen. La consistencia no te quita ese beneficio: solo te pide más días, aunque sean de 250 o 300 $, hasta que el día grande pese la mitad. Alex lo dice claro: «me da igual la consistencia». Cerrar antes por la regla es regalar el día que más paga, y subir el tamaño para compensar es operar para la regla.'
# C6 · clips 74 y 88
d=c(74,'P01_la-apertura-es-un-demonio')
d['explicacion']='La apertura sacude a los dos lados: «te va tirando para arriba, para abajo», y sus primeros cinco minutos son muy agresivos. Por eso Alex no se anticipa ni entra a ciegas con la campana: sería aceptar que el precio se le mueva fuerte en contra aunque la idea sea buena. El primer impulso tampoco manda: puede ser solo la primera sacudida. Operar la apertura es esperar a que enseñe qué hace.'
d['clave']='En el clip: Alex explica por qué no se anticipa a la apertura: «es un demonio», te tira para arriba y para abajo.'
d=c(88,'P03_no-por-tener-un-imbalance'); assert d['correcta']==3
d['explicacion']='Con el precio frenado y sin agresión, ahora mismo lo que toca es no hacer nada: «Ahora, ¿qué esperaría? Nada». El imbalance es una zona para tener presente, no un gatillo: Alex espera a que el precio llegue y mira qué sucede antes de decidir. La orden limitada puesta a ciegas entra solo porque el nivel existe, sin ver cómo llega el precio ni qué hace el flujo.'
# C7 · «a mercado» fuera donde no aporta
opcion(c(36,'E01_dejar-que-barra'),1,'Vendes a mercado: si pierde el Put Wall','Vendes la pérdida del Put Wall: con esa fuerza, lo lógico es irte con el precio')
opcion(c(37,'E01_gonzi-con-ordenes-limite'),2,'Compras a mercado: si quitan las ventas','Buscas la compra: si quitan las ventas del libro es que el precio tiene vía libre para subir')
opcion(c(40,'E01_no-basta-con-llegar-al-call-wall'),2,'La olvidas y compras a mercado','La olvidas y compras la ruptura: si llega con tanta fuerza, lo normal es que lo atraviese')
opcion(c(64,'G01_por-que-promedio-el-big-trade'),1,'Cierras y compras a mercado con más carga','Cierras y te giras a largo con más carga: si esa venta no baja el precio, el giro es seguro')
opcion(c(88,'P03_no-por-tener-un-imbalance'),2,'Compras a mercado hacia el imbalance','Compras para ir hasta el imbalance: en un día lateral el precio acaba yendo al nivel')
# C8 · clip 7
d=c(7,'C02_absorcion-el-precio-cae'); assert 'falso rompimiento' in d['clave']
d['clave']='En el clip: Alex avisa de una posible falsa ruptura y enseña cómo, con el precio cayendo, el delta se vuelve comprador: brotes verdes, absorción.'
# ---- validación de las 90
LIM={'titulo':80,'pregunta':260,'explicacion':400,'clave':150}; err=[]
for n,d in enumerate(q,1):
    a=f"clip {n} {d['id']}"
    assert list(d.keys())==CAMPOS, a
    for k,m in LIM.items():
        if len(d[k])>m or not d[k].strip(): err.append(f'{a}: «{k}» {len(d[k])} > {m}')
    o=d['opciones']
    if len(o)!=4 or len(set(x.strip().lower() for x in o))<4: err.append(f'{a}: opciones')
    for k,x in enumerate(o):
        if len(x)>125: err.append(f'{a}: opción {k} con {len(x)}')
    ls=[len(x) for x in o]
    if ls[d['correcta']]>1.35*max(l for k,l in enumerate(ls) if k!=d['correcta']): err.append(f'{a}: la correcta se regala por larga')
    if not d['clave'].startswith('En el clip:'): err.append(f'{a}: clave')
    if 'gonci' in json.dumps(d,ensure_ascii=False).lower(): err.append(f'{a}: gonci')
rep=Counter(d['correcta'] for d in q)
if any(rep[k]<18 or rep[k]>27 for k in range(4)): err.append(f'reparto {dict(rep)}')
if len({d['id'] for d in q})!=90: err.append('ids repetidos')
if err: print('ERRORES:'); [print(' -',e) for e in err]; sys.exit(1)
json.dump(q,open(P,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
src=src[:i]+',\n'.join(linea(d) for d in q)+src[j:]
open(INDEX,'w',encoding='utf-8').write(src)
print('OK · 90 preguntas válidas · reparto',dict(sorted(rep.items())),'· por categoría',{k:dict(sorted(Counter(d['correcta'] for d in q if d['cat']==k).items())) for k in 'CEGP'})
print('«a mercado» en opciones:',sum(1 for d in q for o in d['opciones'] if 'a mercado' in o))
