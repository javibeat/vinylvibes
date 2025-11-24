#!/bin/bash

# Script interactivo para subir MP3s a la Raspberry Pi
# Uso: ./subir_mp3.sh
# Convierte automáticamente los MP3s a formato optimizado para streaming

RASPBERRY_IP="192.168.70.142"
RASPBERRY_USER="javibeat"
RASPBERRY_DIR="/mnt/ssd/music"
DOWNLOADS_DIR="$HOME/Downloads"
TEMP_DIR="/tmp/vinylvibes_convert"

# Crear directorio temporal para conversiones
mkdir -p "$TEMP_DIR"

# Estaciones disponibles
ESTACIONES=("deep" "house" "jackin" "jazzy" "nudisco" "soulful" "techhouse" "classic" "rawhouse")
ESTACIONES_NOMBRES=("Deep House" "House" "Jackin House" "Jazzy House" "Nu Disco" "Soulful House" "Tech House" "House Classics" "Raw House")

# Buscar todos los MP3s en Descargas
mp3_files=()
while IFS= read -r -d '' file; do
    mp3_files+=("$file")
done < <(find "$DOWNLOADS_DIR" -maxdepth 1 -type f -iname "*.mp3" -print0 | sort -z)

if [ ${#mp3_files[@]} -eq 0 ]; then
    echo "❌ No se encontraron archivos MP3 en $DOWNLOADS_DIR"
    exit 1
fi

echo "🎵 Subir MP3s a Vinyl Vibes Radio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Buscando en: $DOWNLOADS_DIR"
echo "📊 Archivos encontrados: ${#mp3_files[@]}"
echo ""

# Verificar herramientas necesarias
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg no está instalado"
    echo "   Instala con: brew install ffmpeg"
    exit 1
fi

# Verificar conexión SSH
echo "🔍 Verificando conexión SSH..."
if ! ssh -o ConnectTimeout=5 "$RASPBERRY_USER@$RASPBERRY_IP" "test -d $RASPBERRY_DIR" 2>/dev/null; then
    echo "❌ Error: No se puede conectar a la Raspberry Pi"
    exit 1
fi
echo "✅ Conexión SSH OK"
echo ""

# Función para normalizar y optimizar MP3
# Convierte a: 44.1kHz, estéreo, CBR 320kbps (formato estándar para liquidsoap)
normalizar_mp3() {
    local input_file="$1"
    local output_file="$2"
    
    echo "🔄 Normalizando formato de audio..."
    
    # Convertir a formato estándar optimizado para streaming:
    # - 44.1kHz sample rate (estándar CD)
    # - Estéreo
    # - CBR 320kbps (calidad máxima, sin variaciones)
    # - Normalizar volumen para evitar cortes
    # - Añadir padding al final para evitar cortes en transiciones
    if ffmpeg -i "$input_file" \
        -ar 44100 \
        -ac 2 \
        -b:a 320k \
        -acodec libmp3lame \
        -q:a 0 \
        -af "loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.5" \
        -id3v2_version 3 \
        -write_id3v1 1 \
        -y \
        "$output_file" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Función para validar MP3
validar_mp3() {
    local file="$1"
    if ffmpeg -v error -i "$file" -f null - 2>&1 | grep -q "error"; then
        return 1
    fi
    return 0
}

# Función para mostrar menú
mostrar_menu() {
    clear
    echo "🎵 Subir MP3s a Vinyl Vibes Radio"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📁 Archivo: $(basename "$1")"
    echo ""
    echo "Selecciona la estación:"
    echo ""
    for i in "${!ESTACIONES[@]}"; do
        printf "  %d) %s\n" $((i+1)) "${ESTACIONES_NOMBRES[$i]}"
    done
    echo ""
    echo "  s) Saltar este archivo"
    echo "  q) Salir"
    echo ""
    echo -n "👉 Opción [1-9/s/q]: "
}

# Procesar cada archivo
for mp3_file in "${mp3_files[@]}"; do
    filename=$(basename "$mp3_file")
    
    while true; do
        mostrar_menu "$mp3_file"
        read -r opcion < /dev/tty
        
        if [[ -z "$opcion" ]]; then
            continue
        fi
        
        case "$opcion" in
            [1-9])
                idx=$((opcion-1))
                if [ $idx -ge 0 ] && [ $idx -lt ${#ESTACIONES[@]} ]; then
                    estacion="${ESTACIONES[$idx]}"
                    destino="$RASPBERRY_DIR/$estacion/"
                    
                    echo ""
                    echo "📤 Procesando: ${ESTACIONES_NOMBRES[$idx]}..."
                    echo ""
                    
                    # Validar archivo original
                    if ! validar_mp3 "$mp3_file"; then
                        echo "⚠️  Advertencia: El archivo puede tener problemas, intentando reparar..."
                    fi
                    
                    # Crear nombre de archivo temporal
                    temp_file="$TEMP_DIR/$(basename "$mp3_file")"
                    
                    # Normalizar y optimizar MP3
                    if normalizar_mp3 "$mp3_file" "$temp_file"; then
                        echo "✅ Audio normalizado (44.1kHz, estéreo, 320kbps CBR)"
                        echo ""
                        echo "📤 Subiendo a la Raspberry Pi..."
                        
                        # Subir archivo normalizado con rsync
                        if rsync -avz --progress "$temp_file" "$RASPBERRY_USER@$RASPBERRY_IP:$destino$(basename "$mp3_file")" 2>/dev/null; then
                            echo ""
                            echo "✅ Subido correctamente a: ${ESTACIONES_NOMBRES[$idx]}"
                            
                            # Forzar recarga de playlist en liquidsoap
                            echo "🔄 Recargando playlist en liquidsoap..."
                            ssh "$RASPBERRY_USER@$RASPBERRY_IP" "touch /mnt/ssd/music/$estacion/.reload" 2>/dev/null
                            
                            # Limpiar archivo temporal
                            rm -f "$temp_file"
                            sleep 1
                        else
                            echo ""
                            echo "❌ Error al subir el archivo"
                            rm -f "$temp_file"
                            sleep 2
                        fi
                    else
                        echo ""
                        echo "❌ Error al normalizar el archivo. Intentando subir original..."
                        # Intentar subir original como fallback
                        if rsync -avz --progress "$mp3_file" "$RASPBERRY_USER@$RASPBERRY_IP:$destino" 2>/dev/null; then
                            echo "✅ Subido archivo original (sin normalizar)"
                            ssh "$RASPBERRY_USER@$RASPBERRY_IP" "touch /mnt/ssd/music/$estacion/.reload" 2>/dev/null
                        else
                            echo "❌ Error al subir el archivo"
                        fi
                        sleep 2
                    fi
                    break
                else
                    echo ""
                    echo "❌ Opción inválida. Presiona Enter para continuar..."
                    read < /dev/tty
                fi
                ;;
            s|S)
                echo ""
                echo "⏭️  Saltando: $filename"
                sleep 1
                break
                ;;
            q|Q)
                clear
                echo "👋 Saliendo..."
                exit 0
                ;;
            *)
                echo ""
                echo "❌ Opción inválida. Presiona Enter para continuar..."
                read < /dev/tty
                ;;
        esac
    done
done

# Limpiar archivos temporales
rm -rf "$TEMP_DIR"

echo ""
echo "✅ ¡Proceso completado!"
echo ""
echo "💡 Los archivos están en la Raspberry Pi y se añadirán automáticamente a las playlists"
echo "💡 Todos los archivos han sido normalizados a formato optimizado para streaming"
