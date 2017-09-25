
/* Create a WiFi access point and provide a web server on it. */

#include <ESP8266WiFi.h>
#include <WiFiClient.h> 
#include <ESP8266WebServer.h>

#include "DHT.h"

#define DHTTYPE DHT11   // DHT 11

// Pin al que se conecta el sensor, equivale al pin D5 en la NodeMCU
const int DHTPin = 14;     
 
DHT dht(DHTPin, DHTTYPE);

// Nombre del punto de acceso
const char *ssid = "mgiotHumedad";

ESP8266WebServer server(80);

// Funcion que atiende las peticiones del servidor de la Raspberry Pi
void devolverHumedad(){
  // Lectura del valor de humedad del nodo
   float h = dht.readHumidity();
   if (isnan(h)) {
      Serial.println("Failed to read from DHT sensor!");
      h = 0.0f;
   }

  int value = (int) h;
  // Se devuelve el valor en formato de texto plano
  String ret = "";
  ret = ret + value;
  server.send(200, "text/plain", ret);
}

// Funcion que atiende las peticiones de los usuarios con dispositivos moviles
void devolverPagina(){
  // Lectura del valor de humedad del sensor
   float h = dht.readHumidity(); 
   if (isnan(h)) {
      Serial.println("Failed to read from DHT sensor!");
      h = 0.0f;
   }

  // Se devuelve una pagina con el valor embebido
  String ret = "";
  ret = ret + h;
  String webpage="<!DOCTYPE html><html><head><meta http-equiv='refresh' content='3'><meta charset='UTF-8'><title>Nodo Humedad</title></head><body><div style='padding-top: 2cm; padding-left: 2cm; padding-right: 2cm; text-align: center; font-size: 1.5em'> <p style='display:inline'>El valor actual es: <p id='value' style='display:inline'>"+ret+"</p>%</p><input type='button' value='Actualizar valor' onClick='window.location.reload()'></div></body></html>";
  server.send(200, "text/html", webpage);
}


// Funcion de inicializacion de parametros y del servidor web
void setup() {
  delay(1000);
  Serial.begin(115200);
  Serial.println();
  Serial.print("Configurando Punto de Acceso...");
  dht.begin();
  /* Si se desea poner contraseña se ha de indicar con un segundo argumento */
  WiFi.softAP(ssid);
  randomSeed(analogRead(0));
  IPAddress myIP = WiFi.softAPIP();
  Serial.print("Direccion IP del punto de acceso: ");
  Serial.println(myIP);

  // Enrutamiento de direcciones
  server.on("/", devolverPagina);
  server.on("/getData", devolverHumedad);
  server.begin();
  Serial.println("Servidor de HTTP iniciado (Servidor de paginas webs)");

}

void loop() {
  server.handleClient();
}
