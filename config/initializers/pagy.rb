require "pagy/extras/overflow"

Pagy::DEFAULT[:items] = 12
Pagy::DEFAULT[:size] = 7
Pagy::DEFAULT[:overflow] = :last_page
