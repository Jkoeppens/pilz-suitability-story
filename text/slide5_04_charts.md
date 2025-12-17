**Der Entscheidungsbaum zeigt, wie das Modell Schritt für Schritt entscheidet.**

Es nutzt Fundpunkte von Parasolen und Meisen, wobei Meisen näherungsweise für typische Beobachtungsorte von Menschen stehen.

An jeder Verzweigung prüft der Baum einen Satellitenwert:
Wie dicht ist die Vegetation?
Tritt Feuchtigkeit in größeren Clustern auf?
Wie heterogen ist die Umgebung?

Für **jeden dieser Werte setzt das Modell eine Schwelle.** Je nachdem, ob ein Ort darüber oder darunter liegt, folgt der Baum einem anderen Ast. **Am Ende landet jeder Ort in einem Blatt des Baumes.**

Jedes Blatt hat einen **Suitability-Wert: eine Einschätzung zwischen 0 und 1, wie typisch die Umweltbedingungen für einen Pilzfund sind**, im Vergleich zu Punkten, an denen vor allem Menschen unterwegs sind.