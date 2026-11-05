# Recuperar la contrasena que pide el instalador

Esta herramienta cambia la contrasena del usuario **postgres**, no la cuenta de administrador de PlayCoffee. Requiere PostgreSQL instalado como servicio Windows `postgresql-x64-18` y permisos de administrador de Windows.

**Version 2:** corrige el error "no se permite ejecucion del servidor por un usuario con privilegios administrativos". Sigue ejecutando el `.cmd` como administrador de Windows: esta version ya no ejecuta `postgres.exe` desde esa consola. Lee `postgresql.conf` y `postgresql.auto.conf` directamente y utiliza el servicio Windows para arrancar la base con su cuenta de servicio. Si detecta archivos incluidos u otra configuracion personalizada que no puede interpretar, se detiene antes de modificar nada.

1. Extrae todo el ZIP en el equipo donde estas instalando PlayCoffee.
2. Cierra el instalador anterior y evita operar ventas durante el procedimiento: PostgreSQL se detendra brevemente.
3. Haz clic derecho en **RESTABLECER-POSTGRES.cmd > Ejecutar como administrador**.
4. Comprueba la carpeta de datos que aparece. Escribe **RESTABLECER**.
5. Escribe la nueva contrasena cuando PostgreSQL la solicite y repitela. No se muestran los caracteres. Usa una contrasena no vacia, preferentemente de al menos 12 caracteres, y guardala.
6. La herramienta restablece la autenticacion original y pide la nueva contrasena una vez mas para verificar la conexion.
7. Cuando indique **Contrasena comprobada**, ejecuta otra vez **INSTALAR.cmd**. Ingresa el puerto mostrado y la nueva contrasena de `postgres`.

No cierres la ventana ni apagues el equipo durante el cambio. Si el procedimiento se interrumpe, vuelve a ejecutar la herramienta: recupera primero las reglas de autenticacion guardadas. Si falla esa restauracion, conserva el archivo `pg_hba.conf.playcoffee-password-backup` y comunica el error; no borres ni reinstales la base.

La herramienta no borra tablas ni bases. Otros programas que utilicen directamente el usuario postgres tendran que actualizar su contrasena guardada. PlayCoffee instalado con su usuario propio de base de datos conserva esa credencial.

El procedimiento habilita temporalmente acceso sin contrasena solo desde `127.0.0.1`, al usuario postgres en la base postgres. Despues restaura byte por byte las reglas originales, tambien si el cambio falla normalmente. Utiliza [psql y su comando de cambio de contrasena](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-META-COMMAND-PASSWORD), que evita enviar la contrasena en texto plano en los comandos, y sigue el [orden de reglas de autenticacion de PostgreSQL](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html).

Se verifican sintaxis y restauracion con pruebas simuladas; el cambio real debe realizarse y verificarse en el equipo destino. No ejecuta automaticamente ninguna recuperacion al descargar o extraer el ZIP.
